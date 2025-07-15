// components/ForwardedImageEditorWrapper.tsx
import React, { forwardRef, lazy, Suspense } from 'react';
import type { ForwardedImageEditorHandle } from './ForwardedImageEditor';

const LazyEditor = lazy(() => import('./ForwardedImageEditor'));

const ForwardedImageEditorWrapper = forwardRef<ForwardedImageEditorHandle, any>(
  (props, ref) => {
    return (
      <Suspense fallback={<div className="h-[70vh] bg-gray-800 animate-pulse" />}>
        <LazyEditor {...props} ref={ref} />
      </Suspense>
    );
  }
);

ForwardedImageEditorWrapper.displayName = 'ForwardedImageEditorWrapper';
export default ForwardedImageEditorWrapper;
