import { getMps, getAllDivisions, getMemeberVoting } from "./src/apicall";
import { createMpNode, createDivisionNode, setupNeo, createVotedForDivision, cleanUp, setupDataScience, getPartyMpCounts, createPartyNode, createParyRelationships } from "./src/neoManager";
import { MPMessage } from "./src/models/mps";
import { Division, MemberVoting } from "./src/models/divisions";
import { VotedFor } from "./src/models/relationships";
import { readMessage } from "./src/messageManager";

const logger = require('./src/logger');


// const allMps = [{
//   id: 4439,
//   name: "Alberto Costa"
// }];

const endAndPrintTiming = (timingStart: number, timingName: string) => {
  // END timing
  let timingEnd = performance.now();
  logger.info(`<<TIMING>> ${timingName} in ${(timingEnd - timingStart) / 1000} seconds`);
}

const go = async () => {

  let messages_in_queue = true;

  logger.info(`start of create  ${process.env.NEO4J_USER}`)

  // Start timing
  const totalTimeStart = performance.now();
  let timingStart = performance.now();

  await setupNeo();

  let skip = 0;

  //make relationships between mps and divisions
  let votesForMp: Array<VotedFor>;
  let index = 0;
  // @ts-ignore
  let votedAye = [];
  // @ts-ignore
  let votedNo = [];

  let MP_START_NUMBER = 0;

  // for (let i = MP_START_NUMBER; i < allMps.length; i++) {

  while (messages_in_queue) {

    // @ts-ignore
    const mps: Array<MPMessage> = await readMessage();

    if (mps.length === 0) {
      messages_in_queue = false;
    }

    for (let mp of mps) {

      const mpNumber = index + MP_START_NUMBER;

      logger.debug(`get relationships for mp [${mp.name}] ${mp.id}`);

      votesForMp = [];
      index += 1;
      let divisionsVotedCount = 25;
      let mpVoteCount = 0;
      while (divisionsVotedCount === 25) {

        let memeberVotings: Array<MemberVoting>;
        try {
          //for each mp get all the divisions they have voted on
          memeberVotings = await getMemeberVoting(skip, 25, mp.id);
        } catch (error) {
          logger.info("CHECK ME OUT DOING A RETRY!!!!!!!!!")
          //this sometimes fails for network issues so want to retry just once for now
          memeberVotings = await getMemeberVoting(skip, 25, mp.id);
        }

        skip += 25;

        //only create releationships for voted for divisions if we have created the division
        let filterVoteCount = 0;

        if (memeberVotings && Array.isArray(memeberVotings)) {

          memeberVotings.forEach(vote => {
            let votes = {
              mpId: mp.id,
              divisionId: vote.PublishedDivision.DivisionId,
              votedAye: vote.MemberVotedAye
            };

            votesForMp.push(votes);

            if (vote.MemberVotedAye) {
              votedAye.push(vote.PublishedDivision?.DivisionId);
            } else {
              votedNo.push(vote.PublishedDivision?.DivisionId);
            }


            filterVoteCount += 1;
          })

          divisionsVotedCount = memeberVotings.length;
        }

        mpVoteCount = mpVoteCount + filterVoteCount;

      }


      logger.debug(`creating ${votesForMp.length} Neo RELEATIONSHIPS for MP [${mp.name}] ${mp.id}`);
      for (let votedFor of votesForMp) {
        await createVotedForDivision(votedFor);
      }

      logger.debug(`created ${votesForMp.length} RELEATIONSHIPS for MP [${mp.name}] ${mp.id}`);
      skip = 0;
      mpVoteCount = 0;

    }

  }

  logger.info("The End")

}

go();

