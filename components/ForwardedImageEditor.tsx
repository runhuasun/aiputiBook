import React, {
  useImperativeHandle,
  forwardRef,
  useRef,
  useEffect,
} from 'react';
import ToastUIEditor from '@toast-ui/react-image-editor';
import type TuiImageEditor from 'tui-image-editor';

export interface ForwardedImageEditorHandle {
  getInstance: () => TuiImageEditor | null;
}

const ForwardedImageEditor = forwardRef<ForwardedImageEditorHandle, any>(
  (props, ref) => {
    const innerRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      getInstance: () => {
        const instance = innerRef.current?.getInstance?.();
        if (!instance) {
          console.warn('getInstance() 返回 null');
        }
        return instance ?? null;
      },
    }));

    useEffect(() => {
      console.log('🌟 innerRef:', innerRef.current);
    }, []);

    return <ToastUIEditor {...props} ref={innerRef} />;
  }
);

ForwardedImageEditor.displayName = 'ForwardedImageEditor';
export default ForwardedImageEditor;
