import { jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

// Mock the filesystem module
jest.mock('fs');
jest.mock('path');

// Import the handler with require since it's a CommonJS module
const { handler } = require('../../../domains/atm/application/handlers/atm_locator');

// TypeScript interfaces
interface Coordinates {
  lat: number;
  lng: number;
}

interface ATM {
  _id: string ;
  name: string;
  coordinates: Coordinates;
  address: string;
  isOpen: boolean;
  interPlanetary: boolean;
  timings: string[];
  atmHours: string;
  numberOfATMs: number;
}

interface APIGatewayEvent {
  httpMethod: string;
  body?: string;
  pathParameters?: {
    id?: string;
  };
}

describe('ATM Lambda Handler', () => {
  // Store original console.error
  const originalConsoleError = console.error;
  
  // List of expected error messages that should be suppressed
  const expectedErrors = [
    'Error: File read error',
    'Error: SyntaxError: Unexpected token'
  ];

  beforeAll(() => {
    // Only suppress expected errors, but show others
    console.error = (...args: any[]) => {
      const errorMessage = args.join(' ');
      if (!expectedErrors.some(expected => errorMessage.includes(expected))) {
        originalConsoleError.apply(console, args);
      }
    };
  });

  afterAll(() => {
    // Restore original console.error
    console.error = originalConsoleError;
  });

  // Sample ATM data for testing
  const mockAtmData: ATM[] = [
    {
      _id:  "123" ,
      name: "ATM 1",
      coordinates: { lat: 1, lng: 1 },
      address: "Address 1",
      isOpen: true,
      interPlanetary: false,
      timings: ["9-5"],
      atmHours: "24/7",
      numberOfATMs: 2
    },
    {
      _id: "456" ,
      name: "ATM 2",
      coordinates: { lat: 2, lng: 2 },
      address: "Address 2",
      isOpen: false,
      interPlanetary: true,
      timings: ["10-6"],
      atmHours: "24/7",
      numberOfATMs: 1
    }
  ];

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock path.join to return a fixed path that matches the project structure
    (path.join as jest.Mock).mockImplementation((...paths) => {
      // When the handler tries to access the data file, return the correct mock path
      if (paths.includes('atm_data.json')) {
        return '/domains/atm/application/data/atm_data.json';
      }
      return paths.join('/');
    });
    
    // Mock fs.readFileSync to return our test data
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockAtmData));
  });

  describe('POST /atms', () => {
    test('should return all ATMs when no filters are applied', async () => {
      const event: APIGatewayEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({})
      };

      const response = await handler(event);
      const atms = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(atms).toHaveLength(1); // Only non-interplanetary ATMs by default
      expect(atms[0]).toHaveProperty('name');
      expect(atms[0]).toHaveProperty('coordinates');
      expect(atms[0]).toHaveProperty('address');
      expect(atms[0]).toHaveProperty('isOpen');
    });

    test('should filter open ATMs', async () => {
      const event: APIGatewayEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({ isOpenNow: true })
      };

      const response = await handler(event);
      const atms = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(atms).toHaveLength(1);
      expect(atms[0].isOpen).toBe(true);
    });

    test('should filter interplanetary ATMs', async () => {
      const event: APIGatewayEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({ isInterPlanetary: true })
      };

      const response = await handler(event);
      const atms = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(atms).toHaveLength(1);
      expect(atms[0].name).toBe('ATM 2');
    });
  });

  describe('GET /atms/{id}', () => {
    test('should return specific ATM when valid ID is provided', async () => {
      const event: APIGatewayEvent = {
        httpMethod: 'GET',
        pathParameters: { id: '123' }
      };

      const response = await handler(event);
      const atm = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(atm).toHaveProperty('coordinates');
      expect(atm).toHaveProperty('timings');
      expect(atm).toHaveProperty('atmHours');
      expect(atm).toHaveProperty('numberOfATMs');
      expect(atm).toHaveProperty('isOpen');
    });

    test('should return 404 when ATM is not found', async () => {
      const event: APIGatewayEvent = {
        httpMethod: 'GET',
        pathParameters: { id: 'nonexistent' }
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Error handling', () => {
    test('should handle file reading errors', async () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File read error');
      });

      const event: APIGatewayEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({})
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(500);
      expect(JSON.parse(response.body)).toHaveProperty('message', 'Internal server error');
    });

    test('should handle JSON parsing errors', async () => {
      const event: APIGatewayEvent = {
        httpMethod: 'POST',
        body: 'invalid-json'
      };

      const response = await handler(event);
      expect(response.statusCode).toBe(500);
    });
  });
});