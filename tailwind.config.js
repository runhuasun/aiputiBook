/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./app/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            screens: {
                xs: "330px",
            },
            gridTemplateRows: {
                'masonry': 'masonry'
            },
            gridTemplateColumns: {
                'masonry': 'repeat(auto-fill, minmax(240px, 1fr))'
            },
            gridAutoFlow: {
                'masonry': 'dense'
            },
            
            /** 动画由暗变明 */
            keyframes: {
                fadeInFromBlack: {
                    '0%': { filter: 'brightness(0)' },
                    '100%': { filter: 'brightness(1)' },
                },
                ripple: {
                    "0%": { transform: "scale(0.8)", opacity: "0.8" },
                    "50%": { transform: "scale(1.2)", opacity: "0.4" },
                    "100%": { transform: "scale(1.5)", opacity: "0" },
                },
                glow: {
                    "0%, 100%": { filter: "brightness(1.2)" },
                    "50%": { filter: "brightness(2.5)" },
                },        
            },
            animation: {                
                fadeInFromBlack: 'fadeInFromBlack 1s ease-in-out forwards',
                ripple: "ripple 3s infinite ease-out",
                glow: "glow 3s infinite ease-in-out",        
            },
            colors: {
                "white-glow": "#ffffff",
                "cyan-glow": "#afffff",
                "soft-blue": "#88ccff",
            },
            boxShadow: {
                "glow-cyan": "0 0 15px #afffff, 0 0 30px #88ccff",
            },

            maxWidth: {
                'screen': '1920px',
            },
            maxHeight: {
                'screen': '1080px',
            }              
        },
    },
    variants: {
        extend: {
            display: ['group-hover']
        }
    },
    plugins: [require("@tailwindcss/forms"), require("@headlessui/tailwindcss"), require('tailwindcss-grid')({
        grids: [ 'masonry' ],
        gaps: {
            '4': '1rem'
        }
    })],
};

