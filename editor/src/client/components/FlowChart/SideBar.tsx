import { observer } from "mobx-react";
import * as React from "react";
import styled from "styled-components";
import { colors, getVariableValue, space } from "../../../common/design-tokens";
import { useBackend } from "../../backend";
import { ClassItem } from "./ClassItem";
import { CurrentClass } from "./CurrentClass";

const Sidebar = styled.div`
  width: 300px;
  background: ${colors.gray[800]};
  color: ${colors.gray[200]};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-left: 1px solid ${colors.gray[700]};
  > h3 {
    color: ${colors.gray[300]};
    background: ${colors.gray[700]};
    padding: ${space[4]};
  }
`;

const NoClass = styled.div`
  padding: ${space[4]};
  text-align: center;
  color: ${colors.gray[400]};
`;

export const SideBar = observer(() => {
  const backend = useBackend();

  return (
    <Sidebar>
      <ClassItem
        type="Class"
        ports={{
          input: {
            id: "input",
            type: "top",
            properties: {
              linkColor: getVariableValue("activityBar-activeBorder"),
            },
          },
          output: {
            id: "output",
            type: "bottom",
            properties: {
              linkColor: getVariableValue("activityBar-activeBorder"),
            },
          },
        }}
        properties={{
          name: "",
          isEditing: true,
          currentInstanceId: null,
          injectors: [],
          mixins: [],
          observables: [],
          computed: [],
          actions: [],
          instances: {},
        }}
      />
      <h3>Class inspector</h3>
      {backend.chart.selected && backend.chart.selected.id ? (
        <CurrentClass id={backend.chart.selected.id!} />
      ) : (
        <NoClass>No class selected</NoClass>
      )}
    </Sidebar>
  );
});