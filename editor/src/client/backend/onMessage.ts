import { action, observable } from "mobx";
import { colors } from "../../common/design-tokens";
import { Backend, BackendMessage } from "../../common/types";
import { IChart } from "../flow-chart/types/chart";

export const createOnMessage = (chart: IChart, backend: Backend) => {
  return (event: { data: any }) => {
    const message: BackendMessage = JSON.parse(event.data);
    console.log(message);
    switch (message.type) {
      case "init": {
        Object.assign(backend, message.data);
        break;
      }
      case "disconnect": {
        Object.values(chart.nodes).forEach((node) => {
          node.properties.currentInstanceId = null;
          node.properties.instances = {};
        });
        break;
      }
      case "class-delete": {
        const classId = message.data;

        // We do not want to render until everything is deleted
        action(() => {
          delete chart.nodes[classId];

          if (chart.selected && chart.selected.id === classId) {
            chart.selected = {};
          }

          Object.values(chart.links).forEach((link) => {
            if (link.to.nodeId === classId || link.from.nodeId === classId) {
              delete chart.links[link.id];
            }
          });
        })();
        break;
      }
      case "class-update": {
        message.data.injectors.forEach((injector) => {
          const id = `${injector.classId}_${injector.propertyName}`;
          if (!chart.links[id] && injector.classId in chart.nodes) {
            chart.links[id] = {
              id,
              from: {
                portId: "output",
                nodeId: injector.classId,
              },
              to: {
                portId: "input",
                nodeId: message.data.classId,
              },
            };
          }
        });
        chart.nodes[message.data.classId].position.x = message.data.x;
        chart.nodes[message.data.classId].position.y = message.data.y;
        chart.nodes[message.data.classId].properties.injectors =
          message.data.injectors;
        chart.nodes[message.data.classId].properties.observables =
          message.data.observables;
        chart.nodes[message.data.classId].properties.actions =
          message.data.actions;
        chart.nodes[message.data.classId].properties.computed =
          message.data.computed;
        chart.nodes[message.data.classId].properties.mixins =
          message.data.mixins;
        break;
      }
      case "classes": {
        chart.nodes = Object.keys(message.data).reduce<any>((aggr, key) => {
          const {
            classId,
            x,
            y,
            injectors,
            observables,
            computed,
            actions,
            mixins,
          } = message.data[key];
          aggr[classId] = observable({
            id: classId,
            type: "Class",
            ports: {
              input: {
                id: "input",
                type: "top",
                properties: {
                  linkColor: colors.purple[500],
                },
              },
              output: {
                id: "output",
                type: "bottom",
                properties: {
                  linkColor: colors.purple[500],
                },
              },
            },
            position: {
              x,
              y,
            },
            properties: {
              isEditing: false,
              mixins,
              name: key,
              injectors,
              observables,
              computed,
              actions,
              instances: observable({}),
              currentInstanceId: null,
            },
          });

          return aggr;
        }, {});
        chart.links = observable(
          Object.keys(message.data).reduce<any>((aggr, key) => {
            const { classId } = message.data[key];

            Object.assign(
              aggr,
              message.data[key].injectors.reduce<any>((aggr, injector) => {
                const linkId = `${classId}_${injector.classId}_${injector.propertyName}`;

                if (injector.classId in message.data) {
                  aggr[linkId] = {
                    id: linkId,
                    from: {
                      nodeId: injector.classId,
                      portId: "output",
                    },
                    to: {
                      nodeId: classId,
                      portId: "input",
                    },
                  };
                }

                return aggr;
              }, {})
            );

            return aggr;
          }, {})
        );
        break;
      }
      case "app": {
        const appMessage = message.data;

        switch (appMessage.type) {
          case "instance": {
            const node = chart.nodes[appMessage.data.classId];
            const instances = node.properties.instances;

            if (!instances[appMessage.data.instanceId]) {
              instances[appMessage.data.instanceId] = observable({
                values: observable({}),
                injections: observable({}),
                actionExecutions: observable({}),
              });
            }

            if (!node.properties.currentInstanceId) {
              node.properties.currentInstanceId = appMessage.data.instanceId;
            }

            break;
          }
          case "injection": {
            const data = appMessage.data;
            const instances = chart.nodes[data.classId].properties.instances;

            if (!instances[appMessage.data.instanceId]) {
              instances[appMessage.data.instanceId] = observable({
                values: observable({}),
                injections: observable({}),
                actionExecutions: observable({}),
              });
            }

            const instance =
              chart.nodes[data.classId].properties.instances[data.instanceId];

            if (!instance.injections[data.propertyName]) {
              instance.injections[data.propertyName] = observable([]);
            }

            instance.injections[data.propertyName].push(data.injectInstanceId);
            break;
          }
          case "update": {
            const instances =
              chart.nodes[appMessage.data.classId].properties.instances;
            const targetKey = appMessage.data.path.pop()!;

            if (instances[appMessage.data.instanceId]) {
              const targetBase = appMessage.data.path.reduce(
                (aggr, key) => aggr[key],
                instances[appMessage.data.instanceId].values
              );

              targetBase[targetKey] = appMessage.data.value;
            } else {
              instances[appMessage.data.instanceId] = observable({
                values: observable({
                  [targetKey]: appMessage.data.value,
                }),
                injections: observable({}),
                actionExecutions: observable({}),
              });
            }

            if (Object.keys(instances).length === 1) {
              chart.nodes[
                appMessage.data.classId
              ].properties.currentInstanceId = appMessage.data.instanceId;
            }

            break;
          }
          case "splice": {
            const instances =
              chart.nodes[appMessage.data.classId].properties.instances;
            const targetKey = appMessage.data.path.pop()!;

            if (instances[appMessage.data.instanceId]) {
              const targetBase = appMessage.data.path.reduce(
                (aggr, key) => aggr[key],
                instances[appMessage.data.instanceId].values
              );

              if (targetBase[targetKey]) {
                targetBase[targetKey].splice(
                  appMessage.data.index,
                  appMessage.data.deleteCount,
                  ...appMessage.data.items
                );
              } else {
                targetBase[targetKey] = appMessage.data.items;
              }
            } else {
              instances[appMessage.data.instanceId] = observable({
                values: observable({
                  [targetKey]: appMessage.data.items,
                }),
                injections: observable({}),
                actionExecutions: observable({}),
              });
            }

            if (Object.keys(instances).length === 1) {
              chart.nodes[
                appMessage.data.classId
              ].properties.currentInstanceId = appMessage.data.instanceId;
            }

            break;
          }
          case "action": {
            const { classId, instanceId, name, args } = appMessage.data;
            const instances = chart.nodes[classId].properties.instances;

            if (!instances[instanceId]) {
              instances[instanceId] = observable({
                values: observable({}),
                injections: observable({}),
                actionExecutions: observable({}),
              });
            }

            const instance = instances[instanceId];

            if (!instance.actionExecutions[name]) {
              instance.actionExecutions[name] = observable([]);
            }

            instance.actionExecutions[name].unshift({
              args,
            });

            break;
          }
        }
        break;
      }
    }
  };
};