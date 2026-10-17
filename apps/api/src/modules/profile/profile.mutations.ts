import { builder } from "../../builder";
import { guard } from "../../graphql-errors";
import {
  replaceEducation,
  replaceExperiences,
  replaceProjects,
  replaceSkills,
  saveProfile,
} from "./profile.service";
import {
  EducationInput,
  ExperienceInput,
  ProfileInput,
  ProfileRef,
  ProjectInput,
  SkillInput,
} from "./profile.types";

// Every mutation returns the whole Profile so the client cache updates in one go.
builder.mutationFields((t) => ({
  saveProfile: t.field({
    type: ProfileRef,
    description: "Partial update: omitted fields stay, null clears.",
    args: { input: t.arg({ type: ProfileInput, required: true }) },
    resolve: (_root, { input }, ctx) => guard(() => saveProfile(ctx.db, input)),
  }),
  saveExperiences: t.field({
    type: ProfileRef,
    description: "Replaces the whole experience list; order = array order.",
    args: { items: t.arg({ type: [ExperienceInput], required: true }) },
    resolve: (_root, { items }, ctx) => guard(() => replaceExperiences(ctx.db, items)),
  }),
  saveEducation: t.field({
    type: ProfileRef,
    description: "Replaces the whole education list.",
    args: { items: t.arg({ type: [EducationInput], required: true }) },
    resolve: (_root, { items }, ctx) => guard(() => replaceEducation(ctx.db, items)),
  }),
  saveProjects: t.field({
    type: ProfileRef,
    description: "Replaces the whole project list.",
    args: { items: t.arg({ type: [ProjectInput], required: true }) },
    resolve: (_root, { items }, ctx) => guard(() => replaceProjects(ctx.db, items)),
  }),
  saveSkills: t.field({
    type: ProfileRef,
    description: "Replaces the whole skill list. Duplicate names are dropped.",
    args: { items: t.arg({ type: [SkillInput], required: true }) },
    resolve: (_root, { items }, ctx) => guard(() => replaceSkills(ctx.db, items)),
  }),
}));
