import type { DEVELOPER_PUBLIC_PROFILE } from '../constants/developerProfile';
import type { Education } from './education';
import type { Experience } from './experience';
import type { Project } from './projects';
import type { Skill } from './skills';

/**
 * Public profile data shape that mirrors DEVELOPER_PUBLIC_PROFILE.
 * The compile-time guard below ensures the constant satisfies this interface.
 */
export interface ResumeProfileData {
  name: string;
  role: string;
  bio: string;
  bioShort: string;
  birthDate: string;
  careerStartDate: string;
  hero: { greeting: string; focus: string };
  objective: string;
  location: string;
  city: string;
  state: string;
  availability: string;
  links: {
    github: string;
    linkedin: string;
    website: string;
    telegram: string;
    whatsapp: string;
  };
  contacts: { email: string; phone: string };
  languages: ReadonlyArray<{ name: string; level: string }>;
  additionalInfo: ReadonlyArray<string>;
}

// Compile-time guard: DEVELOPER_PUBLIC_PROFILE must satisfy ResumeProfileData.
// This errors at build time if the constant diverges from the interface.
type _AssertProfileAssignable = typeof DEVELOPER_PUBLIC_PROFILE extends ResumeProfileData
  ? true
  : never;

/**
 * Single-request resume payload returned by GET /resume.
 * Contains everything the web resume page and PDF route need.
 */
export interface ResumeAggregateDTO {
  profile: ResumeProfileData;
  experience: Experience[];
  education: Education[];
  skills: Skill[];
  projects: Project[];
}
