import * as express from 'express'
import * as bodyParser from 'body-parser'
import * as cors from 'cors'

import { Connection, createConnection } from "mongoose";
import { ObjectId } from "mongodb";
import { graphqlExpress, graphiqlExpress } from 'graphql-server-express'
import { makeExecutableSchema } from 'graphql-tools'

const HOST_URL = 'http://localhost'
const PORT = 8900
const END_POINT = "graphql"
const API_URL = `${HOST_URL}:${PORT}/${END_POINT}`;
const MONGO_URL = 'mongodb://localhost:27017/ns-preformance-db'

export const start = async () => {
  try {
    const db = await createConnection(MONGO_URL);

    const Applications = db.collection('application');
    const StartUpInfos = db.collection('startupinfo');
    const Devices = db.collection('device');

    const typeDefs = [`
      type Query {
        application(_id: String): Application
        applicationByName(name: String): Application
        applications: [Application]
        startupinfo(_id: String): StartUpInfo
        startupinfos(applicationId: String): [StartUpInfo]
        device(token: String!): Device
        devices: [Device]
      }

      type Application {
        _id: String
        name: String
        gitHubUrl: String
        info: String
        startupinfos: [StartUpInfo]        
      }

      type StartUpInfo {
        _id: String
        applicationId: String
        deviceId: String,
        startupTime: String
        buildInfo: String
        buildDate: String   
        application: Application     
        device: Device
      }

      type Device {
        _id: String
        token: String
        name: String
        type: String
        osVersion: String
        startupinfo: [StartUpInfo]
      }

      type Mutation {
        createApplication(name: String, gitHubUrl: String, info: String): Application
        createStartUpInfo(applicationId: String, startupTime: String, buildInfo: String, buildDate:String, deviceId: String ): StartUpInfo
        createDevice(name: String!, token:String!, type: String, osVersion: String): Device
        removeStartUpInfos(applicationId: String!): StartUpInfo
      }

      schema {
        query: Query
        mutation: Mutation
      }
    `];

    const resolvers = {
      Query: {
        application: async (root, { _id }) => {
          return prepare(await Applications.findOne(new ObjectId(_id)));
        },
        applicationByName: async (root, { name }) => {
          return prepare(await Applications.findOne({ name: name }));
        },
        applications: async () => {
          return (await Applications.find({}).toArray()).map(prepare)
        },
        startupinfo: async (root, { _id }) => {
          return prepare(await StartUpInfos.findOne(new ObjectId(_id)));
        },
        startupinfos: async (root, { applicationId }) => {
          return (await StartUpInfos.find({}).toArray()).map(prepare);
        },
        device: async (root, { token }) => {
          return prepare(await Devices.findOne({ token: token }));
        },
        devices: async () => {
          return (await Devices.find({}).toArray()).map(prepare);
        },
      },
      Application: {
        startupinfos: async ({ _id }) => {
          return (await StartUpInfos.find({ applicationId: _id }).toArray()).map(prepare);
        }
      },
      StartUpInfo: {
        application: async ({ applicationId }) => {
          return prepare(await Applications.findOne(new ObjectId(applicationId)));
        },
        device: async ({ deviceId }) => {
          return prepare(await Devices.findOne(new ObjectId(deviceId)));
        }
      },
      Mutation: {
        createApplication: async (root, args, context, info) => {
          const res = await Applications.insert(args);
          const newPost = await Applications.findOne({ _id: getObjectId(res) });
          return prepare(newPost);
        },
        createStartUpInfo: async (root, args, context, info) => {
          const res = await StartUpInfos.insert(args);
          return prepare(await StartUpInfos.findOne({ _id: getObjectId(res) }));
        },
        createDevice: async (root, args, context, info) => {
          const res = await Devices.insert(args);
          return prepare(await Devices.findOne({ _id: getObjectId(res) }));
        },
        removeStartUpInfos: async (root, args, context, info) => {
          const result = await StartUpInfos.remove({ applicationId: args.applicationId });
          return result;
        }
      },
    }

    const schema = makeExecutableSchema({
      typeDefs,
      resolvers
    });

    const app = express();
    const corsOptions = {
      origin(origin, callback) {
        callback(null, true);
      },
      credentials: false
    };

    app.use(cors(corsOptions));

    const allowCrossDomain = function (req, res, next) {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    }

    app.use(allowCrossDomain);
    app.use(bodyParser.urlencoded({ 'extended': true })); // parse application/x-www-form-urlencoded
    app.use(bodyParser.json()); // parse application/json
    app.use(bodyParser.json({ type: 'application/graphiql' })); // parse application/vnd.api+json as json

    app.use(`/${END_POINT}`, bodyParser.json(), graphqlExpress({
      schema,
      rootValue: resolvers,
    }));
    app.use('/graphiql', graphiqlExpress({
      endpointURL: ''
    }));

    app.listen(PORT, () => console.log(`Now browse to ${API_URL}`));
  } catch (e) {
    console.log(e);
  }
}

const getObjectId = obj => {
  return obj["ops"][0]["_id"];
}

const prepare = (o) => {
  if (o) {
    o._id = o._id.toString()
  }
  return o;
}