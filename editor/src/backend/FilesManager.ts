import * as fs from "fs";
import * as path from "path";

import * as prettier from "prettier";
import * as ts from "typescript";

import { Project } from "ts-morph";

import {
  APP_DIR,
  CONFIGURATION_DIR,
  LIBRARY_IMPORT,
  MIXINS_IMPORT,
} from "../common/constants";
import { ClassMetadata, ExtractedClass, Mixin } from "../common/types";
import * as ast from "./ast-utils";
import { TsMorphFs, writeLineBreak } from "./TsMorphFs";

let prettierConfig = {};

try {
  prettierConfig = JSON.parse(
    fs.readFileSync(path.resolve(".prettierrc")).toString("utf-8")
  );
} catch {
  // No worries, just using defaults
}

export class FilesManager {
  private filesWatcher: fs.FSWatcher | undefined;
  private project: Project = new Project({
    fileSystem: new TsMorphFs(prettierConfig),
  });
  metadata: {
    [name: string]: ClassMetadata;
  } = {};
  classes: {
    [name: string]: ExtractedClass;
  } = {};

  private writePrettyFile(fileName: string, content: string) {
    return fs.promises.writeFile(
      fileName,
      new TextEncoder().encode(
        prettier.format(content, {
          ...prettierConfig,
          parser: path.extname(fileName) === ".json" ? "json" : "typescript",
        })
      )
    );
  }

  private async ensureAppDir() {
    try {
      await fs.promises.mkdir(path.resolve(APP_DIR));
    } catch {
      // Already exists
    }
  }

  private getAppSourceFile(fileName: string) {
    const fullPath = path.resolve(APP_DIR, `${fileName}.ts`);

    return (
      this.project.getSourceFile(fullPath) ||
      this.project.addSourceFileAtPath(fullPath)
    );
  }

  private async ensureConfigurationDir() {
    const configDir = path.resolve(CONFIGURATION_DIR);

    try {
      await fs.promises.mkdir(configDir);
    } catch {
      // Already exists
    }

    try {
      const metadata = await fs.promises.readFile(
        path.resolve(configDir, "metadata.json")
      );
      this.metadata = JSON.parse(new TextDecoder("utf-8").decode(metadata));
    } catch {
      // No file, we will write it later
    }
  }

  private async ensureContainerEntry() {
    const entryFile = path.resolve(APP_DIR, "index.ts");
    try {
      await fs.promises.stat(entryFile);
    } catch {
      // We do not have the file, lets write it
      await this.writePrettyFile(
        entryFile,
        `import { Container } from '${LIBRARY_IMPORT}'
export const container = new Container({}, { devtool: process.env.NODE_ENV === 'development' ? "localhost:5051" : undefined })
`
      );
    }
  }

  private extractClass(classId: string, content: Uint8Array) {
    const node = ts.createSourceFile(
      "temp.ts",
      new TextDecoder("utf-8").decode(content),
      ts.ScriptTarget.Latest
    );

    const classNode = ast.getClassNode(node, classId);
    const mixins = ast.getClassMixins(node, classId);
    const injectors = ast.getInjectors(classNode);
    const observables = ast.getObservables(classNode);
    const computed = ast.getComputed(classNode);
    const actions = ast.getActions(classNode);

    return {
      classId,
      mixins,
      injectors,
      observables,
      computed,
      actions,
    };
  }

  private async getClass(fileName: string): Promise<ExtractedClass> {
    const content = await fs.promises.readFile(path.resolve(APP_DIR, fileName));
    const classId = this.getClassIdFromFileName(fileName);

    return this.extractClass(classId, content);
  }

  private getClassIdFromFileName(fileName: string) {
    return path.basename(fileName, ".ts");
  }

  private async getClasses() {
    const appDir = path.resolve(APP_DIR)!;
    try {
      const files = (await fs.promises.readdir(appDir)).filter(
        (file) =>
          file !== "index.ts" &&
          !file.endsWith(".test.ts") &&
          !file.endsWith(".spec.ts")
      );

      const contents = await Promise.all(
        files.map((file) => fs.promises.readFile(path.resolve(appDir, file)))
      );

      return contents.reduce<{
        [key: string]: ExtractedClass;
      }>((aggr, content, index) => {
        const classId = path.basename(files[index], ".ts");

        aggr[classId] = this.extractClass(classId, content);

        return aggr;
      }, {});
    } catch {
      return {};
    }
  }

  /*
    This is where we map files to nodes and their metadata. Things
    like position and the ID of the node.
  */
  async writeMetadata({
    classId,
    x,
    y,
  }: {
    classId: string;
    x: number;
    y: number;
  }) {
    const file = path.resolve(CONFIGURATION_DIR, "metadata.json")!;

    this.metadata[classId] = {
      x,
      y,
    };
    await this.writePrettyFile(file, JSON.stringify(this.metadata, null, 2));
  }

  /*
    This method writes the initial file content
  */
  async writeClass(classId: string) {
    const file = path.resolve(APP_DIR, classId + ".ts")!;

    await this.writeClassToEntryFile(classId);
    await this.writePrettyFile(file, `export class ${classId} {}`);
  }

  private async writeClassToEntryFile(classId: string) {
    const sourceFile = this.getAppSourceFile("index");

    sourceFile.addImportDeclaration({
      moduleSpecifier: `./${classId}`,
      namedImports: [classId],
    });

    sourceFile
      .getVariableDeclaration("container")
      ?.getInitializer()
      ?.transform((traversal) => {
        const node = traversal.visitChildren();

        if (
          ts.isObjectLiteralExpression(node) &&
          ts.isNewExpression(node.parent) &&
          node.parent.arguments![0] === node
        ) {
          return ts.factory.createObjectLiteralExpression(
            [
              ...node.properties,
              ts.factory.createShorthandPropertyAssignment(classId, undefined),
            ],
            undefined
          );
        }

        return node;
      });

    sourceFile.saveSync();
  }

  /*
    This method adds injections. The type of injection will be part of
    the payload, either "singleton" or "factory"
  */
  async inject({
    fromClassId,
    toClassId,
  }: {
    fromClassId: string;
    toClassId: string;
  }) {
    const sourceFile = this.getAppSourceFile(toClassId);

    ast.addImportDeclaration(sourceFile, LIBRARY_IMPORT, "inject");
    ast.addImportDeclaration(sourceFile, `./${fromClassId}`, fromClassId, true);

    sourceFile.getClass(toClassId)?.addProperty({
      name: fromClassId.toLocaleLowerCase(),
      hasDeclareKeyword: true,
      decorators: [
        {
          name: "inject",
          arguments: [`"${fromClassId}"`],
        },
      ],
      type: fromClassId,
    });

    sourceFile.saveSync();
  }

  async replaceInjection(
    name: string,
    fromName: string,
    propertyName: string,
    toInjection: "inject" | "injectFactory"
  ) {
    const sourceFile = this.getAppSourceFile(name);
    const property = sourceFile.getClass(name)?.getProperty(propertyName)!;

    if (toInjection === "inject") {
      ast.addImportDeclaration(sourceFile, LIBRARY_IMPORT, "inject");
      property.rename(fromName.toLowerCase());
      property.setType(fromName);
      property.getDecorator("injectFactory")?.set({
        name: "inject",
        arguments: [`"${fromName}"`],
      });
    } else {
      ast.addImportDeclaration(sourceFile, LIBRARY_IMPORT, "injectFactory");
      ast.addImportDeclaration(sourceFile, LIBRARY_IMPORT, "IFactory");
      property.rename(`create${fromName}`);
      property.setType(`IFactory<${fromName}>`);
      property.getDecorator("inject")?.set({
        name: "injectFactory",
        arguments: [`"${fromName}"`],
      });
    }

    sourceFile.saveSync();
  }

  async removeInjection(fromClassId: string, toClassId: string) {
    const sourceFile = this.getAppSourceFile(toClassId);

    ast.removeImportDeclaration(sourceFile, `./${fromClassId}`);

    sourceFile
      .getClass(toClassId)
      ?.getProperty((property) => {
        const name = property.getName();

        return (
          name === fromClassId.toLowerCase() || name === `create${fromClassId}`
        );
      })
      ?.remove();

    sourceFile.saveSync();
  }

  async toggleMixin(classId: string, mixin: Mixin) {
    const sourceFile = this.getAppSourceFile(classId);

    ast.addImportDeclaration(sourceFile, MIXINS_IMPORT, "applyMixins");

    switch (mixin) {
      case "Resolver":
      case "Disposable":
        ast.toggleImportDeclaration(sourceFile, MIXINS_IMPORT, mixin);
        ast.toggleMixinInterface(sourceFile, classId, mixin);
        ast.toggleMixin(sourceFile, classId, mixin);
        break;
      case "StateMachine":
        ast.toggleImportDeclaration(sourceFile, MIXINS_IMPORT, mixin);
        ast.toggleImportDeclaration(
          sourceFile,
          MIXINS_IMPORT,
          "StateMachineTransitions"
        );
        ast.toggleMixinInterface(sourceFile, classId, "StateMachine<TState>");
        const stateType = sourceFile.getTypeAlias("TState");
        const clas = sourceFile.getClass(classId)!;
        const transitions = clas.getProperty("transitions");
        const state = clas.getProperty("state");
        if (transitions && state && stateType) {
          transitions.remove();
          state.remove();
          stateType.remove();
        } else {
          ast.addImportDeclaration(sourceFile, LIBRARY_IMPORT, "observable");
          sourceFile.insertTypeAlias(
            sourceFile.getClass(classId)!.getChildIndex(),
            {
              name: "TState",
              isExported: true,
              type: '{ current: "FOO" } | { current: "BAR" }',
            }
          );
          clas.addProperty({
            name: "transitions",
            isReadonly: true,
            type: "StateMachineTransitions<TState>",
            initializer: "{ FOO: { BAR: true }, BAR: { FOO: true } }",
            trailingTrivia: writeLineBreak,
          });
          clas.addProperty({
            name: "state",
            type: "TState",
            initializer: `{ current: "FOO" }`,
            decorators: [
              {
                name: "observable",
              },
            ],
          });
        }
        ast.toggleMixin(sourceFile, classId, mixin);
        break;
    }

    sourceFile.saveSync();
  }

  async deleteClass(classId: string) {
    const file = path.resolve(APP_DIR, classId + ".ts")!;

    await fs.promises.unlink(file);
  }

  async initialize(listeners: {
    onClassChange: (e: ExtractedClass) => void;
    onClassCreate: (e: ExtractedClass) => void;
    onClassDelete: (name: string) => void;
  }) {
    await this.ensureConfigurationDir();
    await this.ensureAppDir();
    await this.ensureContainerEntry();
    this.classes = await this.getClasses();
    this.filesWatcher = fs.watch(
      path.resolve(APP_DIR),
      async (eventType, fileName) => {
        if (
          fileName === "index.ts" ||
          fileName.endsWith(".test.ts") ||
          fileName.endsWith(".spec.ts")
        ) {
          return;
        }

        console.log(eventType, fileName);

        if (eventType === "change") {
          const updatedClass = await this.getClass(fileName);
          this.classes[updatedClass.classId] = updatedClass;
          listeners.onClassChange(updatedClass);
        } else if (
          eventType === "rename" &&
          fs.existsSync(path.resolve(APP_DIR, fileName))
        ) {
          const createdClass = await this.getClass(fileName);
          this.classes[createdClass.classId] = createdClass;
          listeners.onClassCreate(createdClass);
        } else {
          console.log("DELETING!");
          const classId = this.getClassIdFromFileName(fileName);
          delete this.classes[classId];
          delete this.metadata[classId];
          const file = path.resolve(CONFIGURATION_DIR, "metadata.json")!;
          await this.writePrettyFile(
            file,
            JSON.stringify(this.metadata, null, 2)
          );
          const sourceFile = this.getAppSourceFile("index");
          ast.removeImportDeclaration(sourceFile, `./${classId}`);
          sourceFile
            .getVariableDeclaration("container")
            ?.getInitializer()
            ?.transform((traversal) => {
              const node = traversal.visitChildren();

              if (
                ts.isObjectLiteralExpression(node) &&
                ts.isNewExpression(node.parent) &&
                node.parent.arguments![0] === node
              ) {
                return ts.factory.createObjectLiteralExpression(
                  node.properties.filter(
                    (property) =>
                      !property.name ||
                      !ts.isIdentifier(property.name) ||
                      property.name.escapedText !== classId
                  ),
                  undefined
                );
              }

              return node;
            });
          sourceFile.saveSync();
          listeners.onClassDelete(classId);
        }
      }
    );
  }

  getMetadata() {
    return this.metadata;
  }

  dispose() {
    this.filesWatcher?.close();
  }
}
