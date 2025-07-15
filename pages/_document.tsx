import Document, { Head, Html, Main, NextScript } from "next/document";
import {config} from "../utils/config";


class MyDocument extends Document {
    render() {
        return (
            <Html lang="cn">
                <Head>
                    <link rel="ico" href={config.logo32} />
                    <meta property="og:site_name" content={config.appName} />
                </Head>
                <body className="bg-global background-gradient">
                    <Main />
                    <NextScript />
                </body>
            </Html>
        );
    }
}

export default MyDocument;
