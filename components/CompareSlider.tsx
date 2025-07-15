import {
  ReactCompareSlider,
  ReactCompareSliderImage,
} from "react-compare-slider";

export const CompareSlider = ({
  original,
  restored,
  direction = "horizontal", // 默认横向
}: {
  original: string;
  restored: string;
  direction?: "horizontal" | "vertical"; // 可选：horizontal（左右）或 vertical（上下）
}) => {
  return (
    <ReactCompareSlider
      itemOne={<ReactCompareSliderImage src={original} alt="original photo" />}
      itemTwo={<ReactCompareSliderImage src={restored} alt="generated photo" />}
      portrait={direction === "vertical"} // 如果是 vertical 就启用 portrait
      className="flex w-fit mt-5"
    />
  );
};
