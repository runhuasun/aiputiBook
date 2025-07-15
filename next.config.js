require('dotenv').config();

module.exports = {
    env: {
        WEBSITE_URL: process.env.WEBSITE_URL,
    },    
    
    compress: false,
    reactStrictMode: true,
    images: {
        unoptimized: true,  // ✅ 禁用内置 Image Optimizer
        
        deviceSizes: [640, 1080, 2048],  // 只生成这两个版本
        formats: ['image/webp'],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'mp.weixin.qq.com',          
                port: '',
                pathname: '/**'
            },             
            {
                protocol: 'https',
                hostname: '*.myqcloud.com',          
                port: '',
                pathname: '/**'
            }, 
            {
                protocol: 'https',
                hostname: '*.cloudfront.net',          
                port: '',
                pathname: '/**'
            }, 
            {
                protocol: 'http',
                hostname: '*.cloudfront.net',          
                port: '',
                pathname: '/**'
            },             
            {
                protocol: 'https',
                hostname: '*.fal.media',          
                port: '',
                pathname: '/**'
            },             
            {
                protocol: 'https',
                hostname: 'v3.fal.media',          
                port: '',
                pathname: '/**'
            },             
            {
                protocol: 'https',
                hostname: '*.toast.com',          
                port: '',
                pathname: '/**'
            }, 
            {
                protocol: 'http',
                hostname: '*.fal.media',          
                port: '',
                pathname: '/**'
            }, 

            {
                protocol: 'http',
                hostname: '*.theapi.app',          
                port: '',
                pathname: '/**'
            },               
            {
                protocol: 'https',
                hostname: '*.theapi.app',          
                port: '',
                pathname: '/**'
            },   
            
            {
                protocol: 'https',
                hostname: 'img.midjourneyapi.xyz',          
                port: '',
                pathname: '/**'
            },             
            {
                protocol: 'http',
                hostname: 'img.midjourneyapi.xyz',          
                port: '',
                pathname: '/**'
            },             

            
            {
                protocol: 'https',
                hostname: '*.aliyuncs.com',          
                port: '',
                pathname: '/**'
            },             
            {
                protocol: 'http',
                hostname: '*.aliyuncs.com',          
                port: '',
                pathname: '/**'
            },       
            {
                protocol: 'https',
                hostname: 'upcdn.io',
                port: '',
                pathname: '/**'
            },
            {
                protocol: 'https',
                hostname: 'replicate.delivery',
                port: '',
                pathname: '/**'
            },
            {
                protocol: 'https',
                hostname: 'storage.googleapis.com',
                port: '',
                pathname: '/**'
            },        
            {
                protocol: 'https',
                hostname: '*.googleapis.com',
                port: '',
                pathname: '/**'
            },        
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
                port: '',
                pathname: '/**'
            },
    
            {
                protocol: 'https',
                hostname: 'oaidalleapiprodscus.blob.core.windows.net',
                port: '',
                pathname: '/**'
            },
    
            {
                protocol: 'https',
                hostname: '*.aiputi.cn',
                port: '',
                pathname: '/**'
            },
            {
                protocol: 'https',
                hostname: '*.framuse.com',
                port: '',
                pathname: '/**'
            },
            {
                protocol: 'https',
                hostname: '*.niukit.com',
                port: '',
                pathname: '/**'
            },            
            {
                protocol: 'https',
                hostname: 'fileserver.aiputi.cn.w.kunlunaq.com',
                port: '',
                pathname: '/**'
            },
        ],
    },

    async rewrites() {
        return [
            {
                source: '/sitemap.xml', // 捕获对 /sitemap.xml 的请求
                destination: '/api/sitemap.xml', // 重定向到 /api/sitemap.xml
                },
        ]
    },    
        
  async redirects() {
      const destination = process.env.DEFAULT_PAGE;
      if(destination){
          return [
              {
                  source: '/',
                  destination: destination,
                  permanent: true,
              }
          ];
      }else{
          return [ ];
      }
  },
    
};
