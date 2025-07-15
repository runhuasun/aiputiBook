import Image from "./wrapper/Image";

export function RoomGeneration({
  original,
  generated,
}: {
  original: string;
  generated: string;
}) {
  return (
          <Image
            alt="AI设计图"
            width={512}
            height={512}
            src={generated}
            className="rounded-2xl sm:mt-0 mt-2"
          />
  );
}
