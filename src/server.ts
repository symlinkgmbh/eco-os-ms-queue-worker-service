/** 
* Copyright 2018-2019 Symlink GmbH 
* 
* Licensed under the Apache License, Version 2.0 (the "License"); 
* you may not use this file except in compliance with the License. 
* You may obtain a copy of the License at 
*  
*     http://www.apache.org/licenses/LICENSE-2.0 
* 
* Unless required by applicable law or agreed to in writing, software 
* distributed under the License is distributed on an "AS IS" BASIS, 
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
* See the License for the specific language governing permissions and 
* limitations under the License. 
* 
*/ 

import { Bootstrapper } from "./app";
import Config from "config";
import { Log, LogLevel } from "@symlinkde/eco-os-pk-log";
import { errorMiddleware } from "@symlinkde/eco-os-pk-api";
import { IJobWorker } from "./infrastructure/jobWorker/IJobWorker";
import { workerContainer } from "./infrastructure/workerContainer";
import { WORKERTYPES } from "./infrastructure/workerTypes";
import Swagger from "swagger-ui-express";
import * as doc from "./swagger.json";

const app = Bootstrapper.getInstance();
app.init().then((application) => {
  application.use(errorMiddleware);
  application.use("/docs", Swagger.serve, Swagger.setup(doc));
  application.listen(Config.get("server.port"));
  Log.log(`service started on port: ${Config.get("server.port")}`, LogLevel.info);
  const jobWorker: IJobWorker = workerContainer.get<IJobWorker>(WORKERTYPES.IJobWorker);
  jobWorker.initWorkerLoop();
});
