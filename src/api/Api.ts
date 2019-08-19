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

import { AbstractApi } from "@symlinkde/eco-os-pk-api";
import { PkApi } from "@symlinkde/eco-os-pk-models";
import { Application } from "express";
import { Router } from "./Router";

export class Api extends AbstractApi implements PkApi.IApi {
  private router: Router;

  constructor() {
    super();
    this.router = new Router(this.getApp());
  }

  public init(): Promise<Application> {
    return new Promise((resolve) => {
      this.router.initRoutes();
      resolve(this.getApp());
    });
  }
}
