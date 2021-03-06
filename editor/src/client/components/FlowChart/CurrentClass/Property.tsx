import { observer } from "mobx-react";
import * as React from "react";
import { FiBox } from "react-icons/fi";
import styled from "styled-components";

import { colors, space } from "../../../../common/design-tokens";
import {
Property as TProperty
} from "../../../../common/types";
import { useBackend } from "../../../backend";

const PropertyWrapper = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: ${space[2]};
`;

const PropertyIcon = styled(FiBox)`
  margin-right: ${space[2]};
  color: ${colors.gray[600]};
  cursor: pointer;
  :hover {
    color: ${colors.gray[200]};
  }
`;

export const Property = observer(
  ({
    property,
    id,
    toggleObservable
  }: {
    property: TProperty;
    id: string,
    toggleObservable: (id: string, property: TProperty) => void
  }) => {
    return (
      <PropertyWrapper>
		  <PropertyIcon onClick={() => toggleObservable(id, property)} />
        {property.name}
      </PropertyWrapper>
    );
  }
);
