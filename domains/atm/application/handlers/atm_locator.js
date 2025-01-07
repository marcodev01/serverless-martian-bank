const fs = require('fs');
const path = require('path');

// Load ATM data from static JSON file
const loadAtmData = () => {
  const dataPath = path.join(__dirname, '../data/atm_data.json');
  const rawData = fs.readFileSync(dataPath, 'utf8');
  return JSON.parse(rawData);
};

// Get all ATMs with filtering
const getAllAtms = (body) => {
  let atms = loadAtmData();
 
  const query = {
    interPlanetary: false
  };
 
  if (body?.isOpenNow) {
    query.isOpen = true;
  }
 
  if (body?.isInterPlanetary) {
    query.interPlanetary = true;
  }

  atms = atms.filter(atm => {
    return Object.keys(query).every(key => query[key] === atm[key]);
  });

  const filteredAtms = atms.map(atm => ({
    name: atm.name,
    coordinates: atm.coordinates,
    address: atm.address,
    isOpen: atm.isOpen
  }));

  return filteredAtms;
  // return [...filteredAtms]
  //   .sort(() => Math.random() - 0.5)
  //   .slice(0, 4);
};

// Get specific ATM by ID
const getSpecificAtm = (atmId) => {
  const atms = loadAtmData();
  const atm = atms.find(atm => atm._id.$oid === atmId);
 
  if (!atm) {
    return null;
  }

  return {
    coordinates: atm.coordinates,
    timings: atm.timings,
    atmHours: atm.atmHours,
    numberOfATMs: atm.numberOfATMs,
    isOpen: atm.isOpen
  };
};

// Main Lambda handler
exports.handler = async (event) => {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    };

    // Handle POST request for ATM list
    if (event.httpMethod === 'POST') {
      const requestBody = event.body ? JSON.parse(event.body) : {};
      const atms = getAllAtms(requestBody);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(atms)
      };
    }

    // Handle GET request for specific ATM
    if (event.httpMethod === 'GET') {
      const atmId = event.pathParameters?.id;
      const atm = getSpecificAtm(atmId);
      
      if (!atm) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ message: 'ATM not found' })
        };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(atm)
      };
    }

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Internal server error',
        stack: process.env.NODE_ENV === 'production' ? null : error.stack
      })
    };
  }
};