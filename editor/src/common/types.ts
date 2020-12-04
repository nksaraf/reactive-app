export type Backend =
  | {
      status: "pending";
    }
  | {
      status: "no-project";
    }
  | {
      status: "missing-dependencies";
      path: string;
    }
  | {
      status: "ready";
      path: string;
    };

export type PackageJson = {
  dependencies?: { [name: string]: string };
};

export type Injector = {
  classId: string;
  propertyName: string;
  type: "inject" | "injectFactory";
};

export type Observable = {
  name: string;
};

export type Computed = {
  name: string;
};

export type ActionExecution = {
  args: any[];
  time: number;
};

export type Action = {
  name: string;
};

export type ExtractedClass = {
  classId: string;
  mixins: Mixin[];
  injectors: Injector[];
  observables: Observable[];
  computed: Computed[];
  actions: Action[];
};

export type Class = {
  classId: string;
  x: number;
  y: number;
} & ExtractedClass;

export type ClassInstance = {
  values: {
    [key: string]: any;
  };
  injections: {
    [propertyName: string]: number[];
  };
  actionExecutions: {
    [actionName: string]: ActionExecution[];
  };
};

export enum Mixin {
  Disposable = "Disposable",
  Resolver = "Resolver",
  StateMachine = "StateMachine",
  UI = "UI",
}

export type ClassNodeProperties = {
  name: string;
  mixins: Mixin[];
  isEditing: boolean;
  currentInstanceId: number | null;
  injectors: Injector[];
  observables: Observable[];
  computed: Computed[];
  actions: Action[];
  instances: {
    [id: string]: ClassInstance;
  };
};

export type ClientMessage =
  | {
      type: "init";
    }
  | {
      type: "class-new";
      data: {
        classId: string;
        x: number;
        y: number;
      };
    }
  | {
      type: "class-update";
      data: {
        classId: string;
        x: number;
        y: number;
      };
    }
  | {
      type: "inject";
      data: {
        fromClassId: string;
        toClassId: string;
      };
    }
  | {
      type: "inject-replace";
      data: {
        classId: string;
        injectClassId: string;
        propertyName: string;
        injectorType: "inject" | "injectFactory";
      };
    }
  | {
      type: "inject-remove";
      data: {
        fromClassId: string;
        toClassId: string;
      };
    }
  | {
      type: "class-open";
      data: {
        classId: string;
      };
    }
  | {
      type: "run-action";
      data: {
        instanceId: number;
        name: string;
      };
    }
  | {
      type: "toggle-mixin";
      data: {
        mixin: Mixin;
        classId: string;
      };
    }
  | {
      type: "class-delete";
      data: {
        classId: string;
      };
    }
  | {
      type: "class-rename";
      data: {
        classId: string;
        toClassId: string;
      };
    };

export type ClassMetadata = { x: number; y: number };

export type BackendMessage =
  | {
      type: "init";
      data: Backend;
    }
  | {
      type: "disconnect";
    }
  | {
      type: "classes";
      data: {
        [name: string]: Class;
      };
    }
  | {
      type: "class-new";
      data: ExtractedClass;
    }
  | {
      type: "class-update";
      data: Class;
    }
  | {
      type: "app";
      data: AppMessage;
    }
  | {
      type: "class-delete";
      data: string;
    };

export type AppMessage =
  | {
      type: "instance";
      data: {
        classId: string;
        instanceId: number;
      };
    }
  | {
      type: "injection";
      data: {
        propertyName: string;
        injectClassId: string;
        injectInstanceId: number;
        classId: string;
        instanceId: number;
      };
    }
  | {
      type: "update";
      data: {
        classId: string;
        instanceId: number;
        path: string[];
        value: any;
      };
    }
  | {
      type: "splice";
      data: {
        classId: string;
        instanceId: number;
        path: string[];
        index: number;
        deleteCount: number;
        items: any[];
      };
    }
  | {
      type: "action";
      data: {
        classId: string;
        instanceId: number;
        name: string;
        args: any[];
      };
    };
