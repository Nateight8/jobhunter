import { builder } from "./builder";

// One import per module. Adding a feature = a new folder + a line here.
import "./modules/jobs";
import "./modules/profile";

export const schema = builder.toSchema();
