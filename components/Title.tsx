import MediaViewer from "../components/MediaViewer";

interface PageTitleProps {
  config?: any;
  title?: string;
  subTitle?: string;
  help?: string;
}

export default function PageTitle({
  config,
  title,
  subTitle,
  help,
}: PageTitleProps) {
  if (!title) return null;

  return (
    <div className="flex flex-col items-center justify-start space-y-1 py-4">
        <div className="flex flex-row items-center space-x-2">
            <h1 className="text-base font-bold tracking-wide text-gray-200">
                {title}
            </h1>
            {help && (
            <MediaViewer
                title="帮助内容"
                config={config}
                src={help}
                className="w-6 h-6 p-1 rounded-full button-main text-xl"
                text="?"
                />
            )}
        </div>
        
        {subTitle && (
        <p className="text-sm text-gray-400">{subTitle}</p>
        )}
    </div>
  );
}
