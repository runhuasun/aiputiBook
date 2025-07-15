// types/@toast-ui/react-image-editor.d.ts

// types/@toast-ui/react-image-editor.d.ts

declare module '@toast-ui/react-image-editor' {
  import { ComponentClass } from 'react';
  import TuiImageEditor from 'tui-image-editor';

  export interface ImageEditorProps {
    includeUI?: any;
    cssMaxWidth?: number;
    cssMaxHeight?: number;
    selectionStyle?: any;
    usageStatistics?: boolean;
  }

  const ImageEditor: ComponentClass<ImageEditorProps & { ref?: React.Ref<TuiImageEditor> }>;
  export default ImageEditor;
}
