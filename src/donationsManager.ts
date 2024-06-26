
const logger = require('./logger');

import { createDonar } from "./neoManager";

const ROWS_TO_TAKE = 50;

const getUrl = ({ from = "2001-01-01", to = "2002-01-01", start = 0 }) => {
    return `https://search.electoralcommission.org.uk/api/search/Donations?start=${start}&rows=${ROWS_TO_TAKE}&query=&sort=AcceptedDate&order=desc&et=pp&date=Accepted&from=${from}&to=${to}&rptPd=&prePoll=true&postPoll=true&register=ni&register=gb&donorStatus=individual&donorStatus=tradeunion&donorStatus=company&period=3862&period=3865&period=3810&period=3765&period=3767&period=3718&period=3720&period=3714&period=3716&period=3710&period=3712&period=3706&period=3708&period=3702&period=3704&period=3698&period=3700&period=3676&period=3695&period=3604&period=3602&period=3600&period=3598&period=3594&period=3596&period=3578&period=3580&period=3574&period=3576&period=3570&period=3572&period=3559&period=3524&period=3567&period=3522&period=3520&period=3518&period=2513&period=2507&period=2509&period=2511&period=1485&period=1487&period=1480&period=1481&period=1477&period=1478&period=1476&period=1474&period=1471&period=1473&period=1466&period=463&period=1465&period=460&period=447&period=444&period=442&period=438&period=434&period=409&period=427&period=403&period=288&period=302&period=304&period=300&period=280&period=218&period=206&period=208&period=137&period=138&period=128&period=73&period=69&period=61&period=63&period=50&period=40&period=39&period=5&isIrishSourceYes=true&isIrishSourceNo=true&includeOutsideSection75=true`
}

const extractDate = (dateString:string|undefined, otherDate:string|undefined, donar: any, period: string):any => {

    //think this can be a string of null
    if (dateString === "null" || dateString === null || !dateString) {    
        
        if (otherDate === "null" || otherDate === null || !otherDate) {    
            dateString = period;
        } else {
            dateString = otherDate;
        }    
    }

    if (!dateString.includes("Date")) {
        return dateString;
    } 

    try {

        // Use a regular expression to extract the numeric part
        const match = dateString?.match(/\/Date\((\d+)\)\//);        

        if (match && match[1]) {

            const numericPart = match[1];
            const numericDate = parseInt(numericPart, 10);

            // Create a Date object from the numeric part
            const dateObject = new Date(numericDate).toISOString();

            // logger.info(`Valid date string format for ${dateString} - ${otherDate} for ${donar.DonorName} ${donar.ECRef}`);

            return dateObject;
        } else {
            logger.error(`Invalid date string format for ${dateString} - ${otherDate} for ${donar.DonorName} ${donar.ECRef}`);         
        }

    } catch (e) {        
        logger.error(e);
        logger.error(`${donar.DonorName} ${donar.ECRef}`);
        logger.error(`Failed processing date ${dateString} other date is ${otherDate}`)
        
        return undefined;
    }

}

const extractParty = (party: string = "") => {

    if (party.includes("onservative")) {
        return "Conservative";
    } else if (party.includes("abour")) {
        return "Labour";
    } else if (party.includes("emocrat")) {
        return "Liberal Democrat"
    } else if (party.includes("laid")) {
        return "Plaid Cymru";
    } else if (party.includes("hristian")) {
        return "Christian Party";
    } else if (party.includes("UKIP")) {
        return "UK Independence Party";
    } else if (party.includes("SNP")) {
        return "Scottish National Party";
    }

    return party.replace(/[^\w\s]/g, '');
}

export const createDonations = async () => {

    let from = 2001;
    let to = 2002;
    // let from = 2006;
    // let to = 2007;    
    const period = { from, to };
    const currentYear = new Date().getFullYear();

    while (from <= currentYear) {

        console.log(`Processing year ${from}`);

        try {

            let isRecordsRemaining = true;
            let currentlyProcessed = 0;
            let start = 0; 
            while (isRecordsRemaining) {

                const url = getUrl({ from: `${from}-01-01`, to: `${to}-01-01`, start });
                const response = await fetch(url);
                const donationsResult = await response.json();
                
                logger.info(`Got [${donationsResult.Result.length}] of [${donationsResult.Total}] for period: [${from} - ${to}] range: [${start} - ${ROWS_TO_TAKE}]. [${donationsResult.Total - currentlyProcessed}] remain`);

                if (donationsResult.Result.length === 0) {
                    logger.warn(`No results from url ${url}`);
                }

                // @ts-ignore   
                for await (const donar of donationsResult.Result) {
                    
                    if (!donar.AcceptedDate || donar.AcceptedDate && donar.AcceptedDate.includes("Date")) {
                        donar.AcceptedDate = extractDate(donar.AcceptedDate, donar.ReceivedDate, donar, `${from}-11-19T00:00:00.000Z`) || `${from}-11-19T00:00:00.000Z`;
                    }

                    if (!donar.ReceivedDate || donar.ReceivedDate && donar.ReceivedDate.includes("Date")) {
                        donar.ReceivedDate = extractDate(donar.ReceivedDate, donar.AcceptedDate, donar, `${from}-11-19T00:00:00.000Z`) || `${from}-11-19T00:00:00.000Z`;
                    }
                                                            
                    donar.Party = extractParty(donar.RegulatedEntityName);                    
                    // await createDonarNode(donar);
                    await createDonar(donar);
                }

                currentlyProcessed = currentlyProcessed + donationsResult.Result.length;

                if ((currentlyProcessed >= donationsResult.Total) || donationsResult.Result.length === 0) {
                    isRecordsRemaining = false;
                }

                start = start + ROWS_TO_TAKE;

            }

        } catch (error) {
            logger.error(`Failed to get donations for period ${from} - ${to}`, error);
            throw error;
        }

        //TODO leave this in if only testing 1 loop
        // break;

        // Increment the year
        from++;
        to++;

    }

    // createDonarRelationships();

}
