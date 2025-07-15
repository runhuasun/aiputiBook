import { default as Dream } from "./dream";
import * as rmu from "../../utils/roomUtils";
import { config } from "../../utils/config";
import * as monitor from "../../utils/monitor";

export async function getServerSideProps(ctx: any) {
    monitor.logUserRequest(ctx);    
    
    const simRoomBody = await rmu.getRoomBody(ctx?.query?.simRoomId);
    return {
        props: {
            simRoomBody,                
            config,
        },
    };
}
export default function draft({ simRoomBody, func, config }: { simRoomBody:any, func:string, config: any }) {
  return (
      <Dream simRoomBody={simRoomBody} func="garden" config={config}/>
    );
};
