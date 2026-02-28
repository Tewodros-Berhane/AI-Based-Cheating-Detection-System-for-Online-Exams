import * as antd from 'antd';
import { Comment as LegacyComment, Form as LegacyForm, Icon as LegacyIcon } from '@ant-design/compatible';

export * from 'antd';
export const Comment = LegacyComment;
export const Form = LegacyForm;
export const Icon = LegacyIcon;

const antdCompat = {
  ...antd,
  Comment: LegacyComment,
  Form: LegacyForm,
  Icon: LegacyIcon
};

export default antdCompat;
