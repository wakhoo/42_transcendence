import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';

@WebSocketGateway({ cors: true})

export class GameGateway {
  
    tab : string[] = [];

    handleConnection(client: any){

      this.tab.push(client.id);
      console.log("conexion : " , client.id);
      console.log("joueur actuel " ,this.tab);
      
    }

    handleDisconnect(client: any) {

      this.tab = this.tab.filter(id => id !== client.id);
      console.log("deconnexion " , client.id);
      console.log("joueur deco " ,this.tab);
    }

    @SubscribeMessage('draw')
    handleDraw(client: any, donnees : any) {

  console.log(`✏️ Le joueur ${client.id} vient de dessiner :`, donnees);

      client.broadcast.emit('draw', donnees);

    }


}



