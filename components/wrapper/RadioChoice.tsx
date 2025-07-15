function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(" ");
}

export interface RadioChoiceProps extends React.HTMLAttributes<HTMLDivElement> {
    values: Map<string, any>;
    selectedValue:any;
    onSelect: (value: any) => void;
}

export default function RadioChoice({ values, selectedValue, onSelect,  ...props }: RadioChoiceProps) {
   
    return (
        <div {...props} className="w-full flex flex-row items-center justify-center space-x-5">
            {Array.from(values).map( ([value, label]) => (
            <label className="flex flex-row items-center space-x-2">
                <input type="radio" value={value} checked={selectedValue === value} className="radio-dark-green"
                    onChange={(e) => {
                        if(typeof onSelect === "function"){
                            onSelect(e.target.value)
                        }
                    }}
                    />
                <span className="tracking-wider">{label}</span>
            </label>
            ))}
        </div>
    );
}
