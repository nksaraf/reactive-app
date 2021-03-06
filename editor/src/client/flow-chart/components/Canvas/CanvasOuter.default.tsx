import styled from "styled-components";
import { colors } from "../../../../common/design-tokens";
import { IConfig } from "../../types";

export interface ICanvasOuterDefaultProps {
  className?: string;
  config: IConfig;
  children: any;
  ref?: React.Ref<any>;
}

export const CanvasOuterDefault = styled.div<ICanvasOuterDefaultProps>`
  position: relative;
  background-color: ${colors.gray[900]};
  width: 100%;
  overflow: hidden;
  cursor: not-allowed;
` as any;
