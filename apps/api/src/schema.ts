import { builder } from "./builder";

// One import per module. Adding a feature = a new folder + a line here.
import "./modules/jobs";
import "./modules/profile";
import "./modules/documents";
import "./modules/boards";
import "./modules/applications";
import "./modules/answers";

export const schema = builder.toSchema();
