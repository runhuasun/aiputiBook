import styles from "../styles/loading-dots.module.css";

const LoadingDots = ({
  color = "#000",
  style = "small",
  direction = "horizontal",
  count = 3
}: {
  color: string;
  style: string;
  direction?: "horizontal" | "vertical";
  count?: number;  
}) => {
    const getStyleClass = () => {
        const baseClass = style === "small" ? styles.loading2 : styles.loading;
        return `${baseClass} ${direction === "vertical" ? "flex flex-col items-center space-y-3" : ""}`;
    };
    
    return (
        <span className={getStyleClass()}>
            {Array.from({ length: count }).map((_, index) => (
            <span key={index} 
                style={{ backgroundColor: color }} 
                className={styles.dot}
                />
            ))}
        </span>
    );
};

export default LoadingDots;

LoadingDots.defaultProps = {
    style: "small",
};
