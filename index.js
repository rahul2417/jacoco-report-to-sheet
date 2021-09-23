const core = require("@actions/core");
const {google} = require('googleapis');
const fs = require("fs");

async function run() {
  const path = core.getInput("JACOCO_CSV_PATH");
  const spreadsheetId = core.getInput("SPREADSHEET_ID");
  const sheetName = core.getInput("SPREADSHEET_NAME");
  const codeCoverageData = fs.readFileSync(path).toString().split('\n').map(e => e.trim()).map(e => e.split(',').map(e => e.trim())); 
  var refactoredCodeCoverageData = getRefactorCSVCodeCoverageData(codeCoverageData);
  const auth = new google.auth.GoogleAuth({
      keyFile: "keys.json",
      scopes: "https://www.googleapis.com/auth/spreadsheets", 
  });
  const authClientObject = await auth.getClient();
  const googleSheetsInstance = google.sheets({ version: "v4", auth: authClientObject });
  const readData = await googleSheetsInstance.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range: sheetName,
  })
  var googleSheetData
  if(typeof readData.data.values == 'undefined'){
    googleSheetData = refactoredCodeCoverageData
  } else {
    var googleSheetData = readData.data.values;
    for(const i in refactoredCodeCoverageData){
      var isCurrentDataUpdated = false;
      for(const j in googleSheetData){
        if(refactoredCodeCoverageData[i][0] == googleSheetData[j][0]){
          googleSheetData[j].push(refactoredCodeCoverageData[i][1]);
          isCurrentDataUpdated = true
          break;
        }
      }
      if(isCurrentDataUpdated == false){
        googleSheetData.push([refactoredCodeCoverageData[i][0]])
        const length = googleSheetData.length - 1
        for(let i = 0; i<googleSheetData[0].length - 2 ; i++){
          googleSheetData[length].push(0);
        }
        googleSheetData[length].push(refactoredCodeCoverageData[i][1]);
      }
    }
  }
  updateGoogleSpreadSheet(auth,spreadsheetId,sheetName,googleSheetData,googleSheetsInstance)
}

async function updateGoogleSpreadSheet(auth, spreadsheetId, sheetName, googleSheetData, googleSheetsInstance){
  await googleSheetsInstance.spreadsheets.values.clear({
    auth,
    spreadsheetId,
    range: sheetName
  });
  await googleSheetsInstance.spreadsheets.values.append({
      auth,
      spreadsheetId,
      range: sheetName,
      resource: {
          values: googleSheetData
      },
      valueInputOption : "USER_ENTERED"
  });
}

function getRefactorCSVCodeCoverageData(codeCoverageData){
  var isPreviousRecordSame = false;
  var packageName;
  var instructionsMissed = 0;
  var instructionsCovered = 0;
  const todayDate = new Date().toISOString().slice(0, 10);
  var refactoredCodeCoverageData = [["Package","Instruction covered in percentatage on " + todayDate]];
  for(const i in codeCoverageData){
    if(i>0){
        if(isPreviousRecordSame == false){
            packageName = codeCoverageData[i][1];
            instructionsMissed = parseInt(instructionsMissed) + parseInt(codeCoverageData[i][3]);
            instructionsCovered = parseInt(instructionsCovered) + parseInt(codeCoverageData[i][4]);
            isPreviousRecordSame = true;
        } else {
          if(codeCoverageData[i][1] == packageName){
            instructionsMissed = parseInt(instructionsMissed) + parseInt(codeCoverageData[i][3]);
            instructionsCovered = parseInt(instructionsCovered) + parseInt(codeCoverageData[i][4]);
          } else {
            refactoredCodeCoverageData.push([packageName, parseInt((instructionsCovered / (instructionsMissed + instructionsCovered)) * 100)])
            instructionsMissed = 0;
            instructionsCovered = 0;
            instructionsMissed = parseInt(instructionsMissed) + parseInt(codeCoverageData[i][3]);
            instructionsCovered = parseInt(instructionsCovered) + parseInt(codeCoverageData[i][4]);
            isPreviousRecordSame = false;
          }
        }
    }  
  }
  return refactoredCodeCoverageData;
}

run();
