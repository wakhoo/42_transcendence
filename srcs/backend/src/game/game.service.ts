import { Injectable } from '@nestjs/common'

@Injectable()
export class GameService {


	saveMatchHistory(matchData: any) {

		console.log("bien recu dossier match' : ", matchData);

	}


} 