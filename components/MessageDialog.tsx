import React, {
  Fragment,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef
} from "react";
import { Dialog, Transition } from "@headlessui/react";
import TextareaAutosize from "react-textarea-autosize";

// === 类型定义 ===
export type MessageType = "MESSAGE" | "CONFIRM";

interface MessageDialogProps {
  title?: string;
  className?: string;
  onOK?: () => void;
  onCancel?: () => void;
  children?: React.ReactNode;
}

export interface MessageDialogRef {
  showAlert: (message: string, title?: string) => Promise<void>;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
  alertAndWait: (
    message: string,
    title?: string,
    callback?: () => void
  ) => void;
  close: () => void;
}

// === 外部引用 ===
let dialogRef: MessageDialogRef | null = null;

// === 主组件 ===
const MessageDialog = forwardRef<MessageDialogRef, MessageDialogProps>(
  ({ title = "消息", className = "", onOK, onCancel, children }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messageType, setMessageType] = useState<MessageType>("MESSAGE");
    const [dialogProps, setDialogProps] = useState<{
      title: string;
      message: string;
    }>({
      title: "",
      message: ""
    });

    const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);
    const [currentResolve, setCurrentResolve] = useState<((val?: any) => void) | null>(null);

    // 在对话框关闭后，执行 callback
    useEffect(() => {
      if (!isOpen && pendingCallback) {
        const timer = setTimeout(() => {
          pendingCallback?.();
          setPendingCallback(null);
        }, 300); // 动画时间需与 Transition.leave 保持一致
        return () => clearTimeout(timer);
      }
    }, [isOpen, pendingCallback]);

    useImperativeHandle(ref, () => ({
      showAlert: (message, title) => {
        return new Promise<void>((resolve) => {
          setMessageType("MESSAGE");
          setDialogProps({ title: title || "💡 提示", message });
          setCurrentResolve(() => resolve);
          setIsOpen(true);
        });
      },

      showConfirm: (message, title) => {
        return new Promise<boolean>((resolve) => {
          setMessageType("CONFIRM");
          setDialogProps({ title: title || "❓ 询问", message });
          setCurrentResolve(() => resolve);
          setIsOpen(true);
        });
      },

      alertAndWait: (message, title, callback) => {
        setMessageType("MESSAGE");
        setDialogProps({ title: title || "💡 提示", message });
        setPendingCallback(() => callback ?? (() => {}));
        setIsOpen(true);
      },

      close: () => {
        setIsOpen(false);
      }
    }));

    function OK() {
      if (messageType === "CONFIRM" && currentResolve) {
        currentResolve(true);
        setCurrentResolve(null);
      } else if (messageType === "MESSAGE" && currentResolve) {
        currentResolve();
        setCurrentResolve(null);
      }
      onOK?.();
      setIsOpen(false);
    }

    function cancel() {
      if (messageType === "CONFIRM" && currentResolve) {
        currentResolve(false);
        setCurrentResolve(null);
        onCancel?.();
      } else if (messageType === "MESSAGE" && currentResolve) {
        currentResolve();
        setCurrentResolve(null);
      }
      setIsOpen(false);
    }

    return (
      <div className={className}>
        <Transition appear show={isOpen} as={Fragment}>
          <Dialog as="div" className="relative z-10 focus:outline-none" onClose={cancel}>
            <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  className="w-full flex justify-center"
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-300"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full flex flex-col items-center space-y-10 sm:w-4/5 rounded-xl bg-white/5 p-6 backdrop-blur-2xl">
                    <Dialog.Title as="h3" className="font-medium text-white px-20 py-1 text-xl tracking-widest">
                      {dialogProps.title}
                    </Dialog.Title>

                    <div className="w-full items-center text-sm/6 text-white/50 px-10 mt-2">
                      {React.Children.count(children) > 0 ? (
                        <>{children}</>
                      ) : (
                        <TextareaAutosize
                          minRows={6}
                          maxRows={15}
                          className="w-full min-h-48 bg-slate-800 text-gray-300 border border-gray-600 rounded-lg px-4 py-2 text-lg text-center tracking-widest 
                          focus:outline-none focus:!ring-1 focus:!ring-green-800"
                          value={dialogProps.message}
                          readOnly
                          onFocus={(e) => e.target.blur()}
                        />
                      )}
                    </div>

                    {messageType === "CONFIRM" && (
                      <div className="flex flex-row items-center space-x-10 px-10 mt-20 w-full justify-center">
                        <button className="button-gold px-8 py-2" onClick={OK}>
                          确定
                        </button>
                        <button className="button-main px-8 py-2" onClick={cancel}>
                          取消
                        </button>
                      </div>
                    )}

                    {messageType === "MESSAGE" && (
                      <div className="flex flex-row justify-center px-10 mt-20 w-full">
                        <button className="button-gold px-8 py-2" onClick={cancel}>
                          关闭
                        </button>
                      </div>
                    )}
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      </div>
    );
  }
);

MessageDialog.displayName = "MessageDialog";
export default MessageDialog;


// 提供组件
export function AlertProvider() {
  return (
    <MessageDialog
      ref={(ref) => {
        dialogRef = ref;
      }}
    />
  );
}

// 调用 alert
export function alert(message: string, title?: string): Promise<void> {
  if (!dialogRef) {
    console.warn("AlertProvider 未挂载");
    window.alert(title ? `${title}\n${message}` : message);
    return Promise.resolve();
  }
  return dialogRef.showAlert(message, title);
}

// 调用 confirm
export function confirm(message: string, title?: string): Promise<boolean> {
  if (!dialogRef) {
    console.warn("AlertProvider 未挂载");
    return Promise.resolve(window.confirm(title ? `${title}\n${message}` : message));
  }
  return dialogRef.showConfirm(message, title);
}

// 调用 alert 并在关闭后执行回调
export function alertAndWait(message: string, callback: () => void, title?: string): void {
  if (!dialogRef) {
    console.warn("AlertProvider 未挂载");
    window.alert(title ? `${title}\n${message}` : message);
    callback();
    return;
  }
  dialogRef.alertAndWait(message, title, callback);
}
