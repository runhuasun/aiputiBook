import { useEffect, useState } from "react";

function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(" ");
}

export const artists:string[][] = [
      ["张大千", "Zhang Daqian"],
      ["唐伯虎", "Tan Yin"],
      ["胡安·米罗", "Joan Miró"],
      ["保罗·高更", "Paul Gauguin"],
      ["阿尔丰斯·穆夏", "Alphonse Mucha"],
      ["莫奈", "Monet"],
      ["梵高", "Van Gogh"],   
      ["毕加索", "Picasso"],       
      ["草间弥生", "Yayoi Kusama"],   
      ["河原温", "On Kawara"],      
      ["瓦西里·康定斯基", "Wassily Kandinsky"],     
      ["埃贡·席勒", "Egon Schiele"],  
      ["罗伯特·马瑟韦尔", "Robert Motherwell"],      
      ["Alfred Sisley", "Alfred Sisley"],   
      ["汉娜·霍克", "Hannah Höch"],       
      ["保罗·克利", "Paul Klee"],   
      ["图卢兹-劳特累克", "Henri de Toulouse-Lautrec"],      
      ["海伦·佛兰肯瑟勒", "Helen Frankenthaler"],     
      ["克里福·斯蒂尔", "Clyfford Still"],  
      ["赛·托姆布雷", "Cy Twombly"],      
    ];  

export const directors:string[][] = [
      ["伍迪·艾伦", "Woody Allen"],
      ["韦斯·安德森", "Wes Anderson"],   
      ["吕克·贝松", "Luc Besson"],   
      ["奉俊昊", "Bong Joon Ho"],       
      ["查理·卓别林", "Charlie Chaplin"],   
      ["科恩兄弟", "The Coen Brothers"],   
      ["克林特·伊斯特伍德", "Clint Eastwood"],       
      ["谢尔盖·爱森斯坦", "Sergei Eisenstein"],   
      ["希区柯克", "Alfred Hitchcock"],   
      ["北野武", "Takeshi Kitano"],       
      ["王家卫", "Wong Kar-wai"],   
      ["黑泽明", "Akira Kurosawa"],   
      ["罗斯·梅尔", "Russ Meyer"],           
      ["三池崇史", "Takashi Miike"],   
      ["斯皮尔伯格", "Steven Spielberg"],   
      ["昆汀·塔伦蒂诺", "Quentin Tarantino"],       
      ["杜琪峰", "Johnnie To"],   
      ["保罗·范霍文", "Paul Verhoeven"],   
    ];  
  export const photographers:string[][] = [
      ["罗杰·狄金斯", "Roger Deakins"],
      ["瑞秋·莫里森", "Rachel Morrison"], 
      ["布拉福德·杨", "Bradford Young"],
      ["安德烈亚斯·古尔斯基", "Andreas Gursky"], 
      ["安塞尔·亚当斯", "Ansel Adams"],
      ["Miles Aldridge", "Miles Aldridge"], 
      ["Nobuyoshi Araki", "Nobuyoshi Araki"],
      ["Guy Aroch", "Guy Aroch"], 
      ["Iwan Baan", "Iwan Baan"],
      ["Jamie Baldridge", "Jamie Baldridge"], 
      ["詹姆斯·巴洛格", "James Balog"],
      ["布鲁诺·巴贝", "Bruno Barbey"], 
      ["保罗巴森", "Paul Barson"],
      ["Ilse Bing", "Ilse Bing"], 
      ["茱莉‧布拉克曼", "Julie Blackmon"],
      ["Flora Borsi", "Flora Borsi"], 
      ["盖·伯丁", "Guy Bourdin"],
      ["Marianne Breslauer", "Marianne Breslauer"], 
      ["Ray Collins", "Ray Collins"],
      ["格利高里·克鲁德逊", "Gregory Crewdson"], 
      ["Mandy Disher", "Mandy Disher"], 
      ["Adrian Donoghue", "Adrian Donoghue"],
      ["Natalia Drepina", "Natalia Drepina"],     
    ];    

export  const architects:string[][] = [
      ["圣地亚哥·卡拉特拉瓦", "Santiago Calatrava"],
      ["安藤忠雄", "Tadao Ando"],
      ["阿尔瓦·阿尔托", "Alvar Aalto"],
      ["亚历杭德罗·阿拉维纳", "Alejandro Aravena"], 
      ["坂茂", "Shigeru Ban"],
      ["里卡多·波菲尔", "Ricardo Bofill"],
      ["马塞尔·布劳耶", "Marcel Breuer"],
      ["文森特·卡勒博", "Vincent Callebaut"],    
      ["大卫·奇普菲尔德", "David Chipperfield"],
      ["勒·柯布西耶", "Le Corbusier"],
      ["诺曼·福斯特", "Norman Foster"],
      ["巴克敏斯特·富勒", "Buckminster Fuller"], 
      ["安东尼奥·高迪", "Antoni Gaudi"],
      ["弗兰克·盖里", "Frank Gehry"],
      ["麦可·葛瑞夫", "Michael Graves"],
      ["瓦尔特·格罗皮乌斯", "Walter Gropius"],    
      ["扎哈·哈迪德", "Zaha Hadid"],
      ["斯蒂文·霍尔", "Steven Holld"],
      ["维克多·霍塔", "Victor Horta"],
      ["比亚克·英格尔斯", "Bjarke Ingels"], 
      ["伊东丰雄", "Toyo Ito"],
      ["菲利普·约翰逊", "Philip Johnson"],
      ["隈研吾", "Kengo Kuma"],
      ["丹尼尔·里博斯金德", "Daniel Libeskind"],    
      ["理查德·迈耶", "Richard Meier"],
      ["奥斯卡·尼迈耶", "Oscar Niemeyer"],
      ["让·努维尔", "Jean Nouvel"],
      ["Valerio Olgiati", "Valerio Olgiati"], 
      ["伦佐·皮亚诺", "Renzo Piano"],
      ["理查德·罗杰斯", "Richard Rogers"],
      ["埃罗·沙里宁", "Eero Saarinen"],
      ["摩西·萨夫迪", "Moshe Safdie"],   
      ["哈里·塞德勒", "Harry Seidler"],
      ["阿尔瓦罗 · 西扎", "Alvaro Siza"],
      ["保罗·索莱里", "Paolo Soleri"],
      ["埃托·索特萨斯", "Ettore Sottsass"], 
      ["詹姆斯·斯特林", "James Stirling"],
      ["路易斯·沙利文", "Louis Sullivan"],
      ["丹下健三", "Kenzo Tange"],
      ["伯纳德·屈米", "Bernard Tschumi"],    
      ["罗伯特·文丘里", "Robert Venturi"],
      ["奥托·瓦格纳", "Otto Wagner"],
      ["彼得·祖索尔", "Peter Zumthor"],
      ["路德维希·密斯·凡德罗", "Ludwig Mies van der Rohe"], 
      ["弗兰克·劳埃德·赖特", "Frank Lloyd Wright"],
      ["雷姆·库哈斯", "Rem Koolhaas"],
      ["阿道夫·路斯", "Adolf Loos"],

    ];

export const methods:string[][] = [
      ["照片", "Photograph, (((detailed face))), RAW photo 8k uhd , highres, RAW photo 8k uhd, modelshot, realistic, movie, intricate details,"],
      ["国画", "(((Tradition Chinese Painting style)))"],
      ["日本画", "(((Japanese Painting style)))"],  
      ["油画", "(((Oil Painting style)))"],   
      ["水彩画", "(((a Watercolor painting)))"],  
      ["粉笔画", "(((a Chalk)))"],  
      ["素描", "(((a Sketch))), B&W"],  
      ["木炭艺术", "(((a Charcoal Art)))"],  
      ["彩色铅笔", "(((Colored Pencil)))"],  
      ["蜡笔画", "(((Crayon style)))"],  
      ["喷绘", "(((a Spray painting)))"],  
    ];  

 export const styles:string[][] = [
      ["写实主义", "Photorealism"],
      ["数字艺术", "digital art"],
      ["杂志", "Magazine"],
      ["宜家风", "IKEA guide"],   
      ["漫画书", "comic book"],   
      ["卡通风格", "cartoon style"],        
      ["巴洛克", "baroque art style"],   
      ["新艺术运动", "art nouveau style"],      
      ["壁画艺术", "fresco art style"],     
      ["印象派", "impressionism art style"],    
      ["肖像艺术", "portrait art style"],       
      ["超现实主义", "surrealism art style"],       
      ["电影海报", "movie poster"],       
      ["报纸", "Newspaper"],   
      ["浮世绘", "Ukiyo-e art"],       
      ["调色刀", "palette knife painting"],       
      ["皮克斯", "pixar style"],        
      ["赤壁", "ghibli style"],       
      ["乙烯基人偶", "vinyl figure"],       
      ["装配图", "Assembly Drawing"],  
    ]; 

export  const shoots:string[][] = [
      ["单反相机", "DSLR"],
      ["长焦镜头", "telephoto lens"],
      ["超广角", "super wide angle"],
      ["微距", "microscopic view"],   
      ["移轴镜头", "tilt-shift"],   
    ];  

export  const bodys:string[][] = [
      ["全身照片", "full body"],
      ["特写照片", "Detail Shot(ECU)"],
      ["脸部特写", "Face Shot (VCU)"],
      ["胸部以上", "Chest Shot(MCU)"],   
      ["腰部以上", "Waist Shot(WS)"],   
    ];    

export const angels:string[][] = [
      ["第一人称视角", "first-person view"],
      ["鸟瞰", "A bird's-eye view,aerial view"],
      ["顶视", "Top view"],
      ["仰视", "Bottom view"],   
      ["电影视角", "cinematic shot"],   
      ["大远景", "extreme long shot"],
      ["中远景", "long shot"],
      ["中景", "Mid shot"],
      ["超特写", "extreme close up"],   
      ["中特写", "medium close up"], 
      ["特写", "close up"],
      ["空镜", "scenery shot"],   
      ["卫星视图", "satellite view"],          
    ];    

export const lights:string[][] = [
      ["工作室照明", "studio lighting"],
      ["电影照明", "film lighting"],
      ["美丽照明", "beautiful lighting"],
      ["柔光照明", "Soft illumination"],   
      ["戏剧性照明", "dramatic lighting"],   
      ["体积光", "Volumetric lighting"],
      ["气氛光", "mood lighting"],
      ["边缘光", "rim lights"],
      ["逆光", "Back lighting"],   
      ["高对比侧面光", "Split Lighting"], 
      ["人物45度侧光", "Rembrandt Lighting"],
      ["生物发光", "bioluminescence"],   
      ["云隙光/耶稣光", "Crepuscular Ray"],       
      ["闪烁的光线", "rays of shimmering light"],       
    ];    

export const atmospheres:string[][] = [  
      ["黑暗气氛", "Dark"],    
      ["光亮的气氛", "Light"],
      ["反光气氛", "Reflective"],
      ["朦胧的气氛", "Hazy"],
      ["迷人的气氛", "Enchanting"], 
      ["梦幻般的氛围", "Dreamy"],
      ["神秘的气氛", "Mystical"],
      ["俏皮的气氛", "Playful"],
      ["异想天开的气氛", "Whimsical"],    
      ["诡秘的气氛", "Mysterious"],
      ["谜一般的气氛", "Enigmatic"],
      ["柔和的氛围", "Mellow"],
      ["空灵的氛围", "Ethereal"], 
      ["平静的气氛", "Calm"],
      ["宁静的氛围", "Tranquil"],
      ["和平的氛围", "Peaceful"],
      ["令人放松的氛围", "Relaxing"],   
      ["复杂的氛围", "Sophisticated"],
      ["幸福的氛围", "Blissful"],
      ["禅意氛围", "Zen"],
      ["喜怒无常的气氛", "Moody"],    
      ["寒冷的气氛", "Chill"],
      ["紧张的气氛", "Intense"],
      ["忧郁的气氛", "Melancholic"],
      ["怀旧的气氛", "Nostalgic"], 
      ["节日气氛", "Festive"],
      ["工业气氛", "Industrial"],
      ["乡村气氛", "Rustic"],
      ["哥特式氛围", "Gothic"],     
      ["浪漫的氛围", "Romantic"],
    ];  



interface SysPromptsProps {
    showMoreWords: (isShow: boolean) => void;
    appendPrompts: (prompts: string) => void;
    promptType?: string;
}

export default function SysPrompts({ showMoreWords, appendPrompts, promptType="PORTRAIT"}: SysPromptsProps) {

    let showArtist: boolean = false; 
    let showDirector: boolean = false;
    let showPhotographer: boolean = false;
    let showArchitect: boolean = false;
    let showMethod: boolean = false;
    let showStyle: boolean = false;

    switch(promptType){
        case "PORTRAIT":
            showMethod=true;
            showStyle=true;
            showArtist=true;
            showPhotographer=true;
            break;
        default:
            showArtist=true; 
            showDirector=true;
            showPhotographer=true;
            showArchitect=true;
            showMethod=true;
            showStyle=true;
    }            

    const [artist, setArtist] = useState("");
    const [director, setDirector] = useState("");
    const [photographer, setPhotographer] = useState("");
    const [architect, setArchitect] = useState("");
    const [method, setMethod] = useState("");
    const [style, setStyle] = useState("");
    const [shoot, setShoot] = useState("");
    const [body, setBody] = useState("");
    const [angel, setAngel] = useState("");
    const [light, setLight] = useState("");
    const [atmosphere, setAtmosphere] = useState("");


    
  function recalcPrompts(input: string){
      let result = input ? input : "";

      if(method && method.trim() != ""){
        result += " , " + method;
      }
      if(style && style.trim() != ""){
        result += " , " + style;
      }    
      if(shoot && shoot.trim() != ""){
        result += " , " + shoot;
      }
      if(body && body.trim() != ""){
        result += " , " + body;
      }
      if(angel && angel.trim() != ""){
        result += " , " + angel;
      }
      if(light && light.trim() != ""){
        result += " , " + light;
      }       
      if(atmosphere && atmosphere.trim() != ""){
        result += " , " + atmosphere + " Atmosphere";
      }    
      if(artist && artist.trim() != ""){
        result += " , a beautiful painting by " + artist;
      }
      if(director && director.trim() != ""){
        result += " , The picture is from " + director + "'s work";
      }
      if(photographer && photographer.trim() != ""){
        result += " by " + photographer;
      }
      if(architect && architect.trim() != ""){
        result += " , by " + architect;
      }

       return result;
  }

  
  useEffect(() => {
    // 当 body 的值变化时，调用 appendPrompts
    appendPrompts(recalcPrompts(""));
  }, [method, style,light, artist, photographer, director, architect, shoot, body, angel, atmosphere]); // 传入 body 作为依赖项

  
  
  return (
        <div className="relative inline-block w-full rounded-xl items-center mt-2 hidden group-focus-within:flex flex-col border border-gray-200 ">
           <button onClick={(e:any) => {
              e.stopPropagation();            
              showMoreWords(false);
              setMethod("");
              setStyle("");
              setLight("");
              setArtist("");
              setPhotographer("");
              setDirector("");
              setArchitect("");
              setShoot("");
              setBody("");
              setAngel("");
              setAtmosphere("");
             }}
            className="absolute top-0 right-0 z-10 w-8 h-8 flex items-center justify-center text-gray-200 hover:text-green-500">
            <span className="sr-only">删除</span>
            <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20">
              <path d="M14.348 5.652a.999.999 0 0 0-1.414 0L10 8.586l-2.93-2.93a.999.999 0 1 0-1.414 1.414L8.586 10l-2.93 2.93a.999.999 0 1 0 1.414 1.414L10 11.414l2.93 2.93a.999.999 0 1 0 1.414-1.414L11.414 10l2.93-2.93a.999.999 0 0 0 0-1.414z"></path>
            </svg>
          </button>


         {showMethod && (
          <div className="w-full flex flex-wrap text-left items-left  px-2 py-2 space-x-2 rounded-xl hover:bg-gray-800">
            <span className=" text-gray-100 font-medium">绘图方法：</span>
            { methods && methods.map((word) => (
              <button className={word[1] == method ? 'button-main px-1 mb-1' : 'button-gray px-1 mb-1'}    
                      onClick={(e:any) => {
                          e.stopPropagation();
                          word[1] == method ? setMethod("") : setMethod( word[1] );
                      }} 
              >
                {word[0]}
              </button>
            ))}                             
          </div>
          )}

            {showStyle && (
          <div className="w-full flex flex-wrap text-left items-left  px-2 py-2  space-x-2 hover:bg-gray-800">
            <span className=" text-gray-100 font-medium">构图风格：</span>
            { styles && styles.map((word) => (
              <button className={word[1] == style ? 'button-main px-1 mb-1' : 'button-gray px-1 mb-1'}    
                      onClick={(e:any) => {
                          e.stopPropagation();
                          word[1] == style ? setStyle("") : setStyle( word[1] );
                      }} 
              >
                {word[0]}
              </button>
            ))}                             
          </div>
            )}            

          <div className="w-full flex flex-wrap text-left items-left  px-2 py-2  space-x-2 hover:bg-gray-800">
            <span className=" text-gray-100  font-medium">拍摄镜头：</span>
            { shoots && shoots.map((word) => (
              <button className={word[1] == shoot ? 'button-main px-1 mb-1' : 'button-gray px-1 mb-1'}    
                      onClick={(e:any) => {
                          e.stopPropagation();
                          word[1] == shoot ? setShoot("") : setShoot( word[1] );                  
                      }} 
              >
                {word[0]}
              </button>
            ))}                             
          </div>

          <div className="w-full flex flex-wrap text-left items-left  px-2 py-2  space-x-2 hover:bg-gray-800">
            <span className=" text-gray-100  font-medium">人像构图：</span>
            { bodys && bodys.map((word) => (
              <button className={word[1] == body ? 'button-main px-1 mb-1' : 'button-gray px-1 mb-1'}    
                      onClick={(e:any) => {
                          e.stopPropagation();
                          word[1] == body ? setBody("") : setBody( word[1] );                  
                      }} 
              >
                {word[0]}
              </button>
            ))}                             
          </div>

          <div className="w-full flex flex-wrap text-left items-left  px-2 py-2  space-x-2 hover:bg-gray-800">
            <span className=" text-gray-100 font-medium">拍摄角度：</span>
            { angels && angels.map((word) => (
              <button className={word[1] == angel ? 'button-main px-1 mb-1' : 'button-gray px-1 mb-1'}    
                      onClick={(e:any) => {
                          e.stopPropagation();
                          word[1] == angel ? setAngel("") : setAngel( word[1] );
                      }} 
              >
                {word[0]}
              </button>
            ))}                             
          </div>

          <div className="w-full flex flex-wrap text-left items-left  px-2 py-2  space-x-2 hover:bg-gray-800">
            <span className="text-gray-100 font-medium">光线风格：</span>
            { lights && lights.map((word) => (
              <button className={word[1] == light ? 'button-main px-1 mb-1' : 'button-gray px-1 mb-1'}    
                      onClick={(e:any) => {
                          e.stopPropagation();
                          word[1] == light ? setLight("") : setLight( word[1] );                  
                      }} 
              >
                {word[0]}
              </button>
            ))}                             
          </div>


          <div className="w-full flex flex-wrap text-left items-left  px-2 py-2  space-x-2 hover:bg-gray-800">
            <span className="text-gray-100 font-medium">画面氛围：</span>
            { atmospheres && atmospheres.map((word) => (
              <button className={word[1] == atmosphere ? 'button-main px-1 mb-1' : 'button-gray px-1 mb-1'}    
                      onClick={(e:any) => {
                          e.stopPropagation();
                          word[1] == atmosphere ? setAtmosphere("") : setAtmosphere( word[1] );
                      }} 
              >
                {word[0]}
              </button>
            ))}                             
          </div>   

            {showArtist && (
          <div className="w-full flex flex-wrap text-left items-left  px-2 py-2 space-x-2 hover:bg-gray-800">
            <span className="text-gray-100 font-medium">艺术家：</span>
            { artists && artists.map((word) => (
              <button className={word[1] == artist ? 'button-main px-1 mb-1' : 'button-gray px-1 mb-1'}    
                      onClick={(e:any) => {
                          e.stopPropagation();
                          word[1] == artist ? setArtist("") : setArtist( word[1] );                  
                      }} 
              >
                {word[0]}
              </button>
            ))}                             
          </div>
            )}

            {showPhotographer && (
          <div className="w-full flex flex-wrap text-left items-left  px-2 py-2  space-x-2 hover:bg-gray-800">
            <span className="text-gray-100 font-medium">摄影师：</span>
            { photographers && photographers.map((word) => (
              <button className={word[1] == photographer ? 'button-main px-1 mb-1' : 'button-gray px-1 mb-1'}    
                      onClick={(e:any) => {
                          e.stopPropagation();
                          word[1] == photographer ? setPhotographer("") : setPhotographer( word[1] );                  
                      }} 
              >
                {word[0]}
              </button>
            ))}                             
          </div>                   
              )}
            

            {showDirector && (
          <div className="w-full flex flex-wrap text-left items-left  px-2 py-2  space-x-2 hover:bg-gray-800">
            <span className="text-gray-100 font-medium">导演风格：</span>
            { directors && directors.map((word) => (
              <button className={word[1] == director ? 'button-main px-1 mb-1' : 'button-gray px-1 mb-1'}    
                      onClick={(e:any) => {
                          e.stopPropagation();
                          word[1] == director ? setDirector("") : setDirector( word[1] );                  
                      }} 
              >
                {word[0]}
              </button>
            ))}                             
          </div>  
            )}
            
      
          { showArchitect &&  (
          <div className="w-full flex flex-wrap text-left items-left px-2 py-2 space-x-2 rounded-xl hover:bg-gray-800">
            <span className="text-gray-100 font-medium">建筑设计师：</span>
            { architects && architects.map((word) => (
              <button className={word[1] == architect ? 'button-main px-1 mb-1' : 'button-gray px-1 mb-1'}    
                      onClick={(e:any) => {
                          e.stopPropagation();
                          word[1] == architect ? setArchitect("") : setArchitect( word[1] );                  
                      }} 
              >
                {word[0]}
              </button>
            ))}                             
          </div>     
          )}

          

        </div>

   
    
  );

 
}


  
    
