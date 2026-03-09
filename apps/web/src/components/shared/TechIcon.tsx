import {
  SiAngular,
  SiAnsible,
  SiApache,
  SiAstro,
  SiBabel,
  SiBun,
  SiCloudflare,
  SiCypress,
  SiDart,
  SiDeno,
  SiDigitalocean,
  SiDjango,
  SiDocker,
  SiElasticsearch,
  SiElixir,
  SiEslint,
  SiExpo,
  SiExpress,
  SiFastapi,
  SiFastify,
  SiFlask,
  SiGit,
  SiGithub,
  SiGithubactions,
  SiGitlab,
  SiGo,
  SiGooglecloud,
  SiGrafana,
  SiGraphql,
  SiHaskell,
  SiHono,
  SiHtml5,
  SiIonic,
  SiJavascript,
  SiJenkins,
  SiJest,
  SiKotlin,
  SiKubernetes,
  SiLaravel,
  SiLinux,
  SiLua,
  SiMariadb,
  SiMongodb,
  SiMysql,
  SiNestjs,
  SiNetlify,
  SiNextdotjs,
  SiNginx,
  SiNodedotjs,
  SiNpm,
  SiNuxt,
  SiNx,
  SiPhp,
  SiPnpm,
  SiPostgresql,
  SiPostman,
  SiPrettier,
  SiPrisma,
  SiPrometheus,
  SiPython,
  SiReact,
  SiRedis,
  SiRemix,
  SiRuby,
  SiRubyonrails,
  SiRust,
  SiScala,
  SiSharp,
  SiSolid,
  SiSpringboot,
  SiSqlite,
  SiStorybook,
  SiSupabase,
  SiSvelte,
  SiSwift,
  SiTailwindcss,
  SiTerraform,
  SiThreedotjs,
  SiTraefikproxy,
  SiTrpc,
  SiTypescript,
  SiVercel,
  SiVite,
  SiVitest,
  SiVuedotjs,
  SiWebpack,
  SiYarn,
} from '@icons-pack/react-simple-icons';
import {
  Cloud,
  Code2,
  Container,
  Database,
  FileText,
  GitBranch,
  Layers,
  Server,
  Shield,
  Tag,
  Terminal,
  Wrench,
  Zap,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { Badge } from '@/components/ui/badge';

// Map of Simple Icons — must stay in sync with TAG_CATALOG icon_keys (si: prefix).
// Icon names must match actual exports from @icons-pack/react-simple-icons.
// Icons absent from the installed package (Java, AWS, Azure, Playwright) use
// lucide: fallbacks in the catalog and are not listed here.
const SI_MAP: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  // Languages
  SiTypescript: SiTypescript as ComponentType<SVGProps<SVGSVGElement>>,
  SiJavascript: SiJavascript as ComponentType<SVGProps<SVGSVGElement>>,
  SiNodedotjs: SiNodedotjs as ComponentType<SVGProps<SVGSVGElement>>,
  SiPython: SiPython as ComponentType<SVGProps<SVGSVGElement>>,
  SiPhp: SiPhp as ComponentType<SVGProps<SVGSVGElement>>,
  SiRust: SiRust as ComponentType<SVGProps<SVGSVGElement>>,
  SiGo: SiGo as ComponentType<SVGProps<SVGSVGElement>>,
  SiRuby: SiRuby as ComponentType<SVGProps<SVGSVGElement>>,
  SiSwift: SiSwift as ComponentType<SVGProps<SVGSVGElement>>,
  SiKotlin: SiKotlin as ComponentType<SVGProps<SVGSVGElement>>,
  SiSharp: SiSharp as ComponentType<SVGProps<SVGSVGElement>>, // C#
  SiHtml5: SiHtml5 as ComponentType<SVGProps<SVGSVGElement>>,
  SiDart: SiDart as ComponentType<SVGProps<SVGSVGElement>>,
  SiElixir: SiElixir as ComponentType<SVGProps<SVGSVGElement>>,
  SiScala: SiScala as ComponentType<SVGProps<SVGSVGElement>>,
  SiLua: SiLua as ComponentType<SVGProps<SVGSVGElement>>,
  SiHaskell: SiHaskell as ComponentType<SVGProps<SVGSVGElement>>,
  // Frameworks
  SiReact: SiReact as ComponentType<SVGProps<SVGSVGElement>>,
  SiNextdotjs: SiNextdotjs as ComponentType<SVGProps<SVGSVGElement>>,
  SiVuedotjs: SiVuedotjs as ComponentType<SVGProps<SVGSVGElement>>,
  SiNuxt: SiNuxt as ComponentType<SVGProps<SVGSVGElement>>,
  SiAngular: SiAngular as ComponentType<SVGProps<SVGSVGElement>>,
  SiSvelte: SiSvelte as ComponentType<SVGProps<SVGSVGElement>>,
  SiHono: SiHono as ComponentType<SVGProps<SVGSVGElement>>,
  SiExpress: SiExpress as ComponentType<SVGProps<SVGSVGElement>>,
  SiNestjs: SiNestjs as ComponentType<SVGProps<SVGSVGElement>>,
  SiFastify: SiFastify as ComponentType<SVGProps<SVGSVGElement>>,
  SiDjango: SiDjango as ComponentType<SVGProps<SVGSVGElement>>,
  SiFastapi: SiFastapi as ComponentType<SVGProps<SVGSVGElement>>,
  SiLaravel: SiLaravel as ComponentType<SVGProps<SVGSVGElement>>,
  SiSpringboot: SiSpringboot as ComponentType<SVGProps<SVGSVGElement>>,
  SiTailwindcss: SiTailwindcss as ComponentType<SVGProps<SVGSVGElement>>,
  SiTrpc: SiTrpc as ComponentType<SVGProps<SVGSVGElement>>,
  SiAstro: SiAstro as ComponentType<SVGProps<SVGSVGElement>>,
  SiRemix: SiRemix as ComponentType<SVGProps<SVGSVGElement>>,
  SiSolid: SiSolid as ComponentType<SVGProps<SVGSVGElement>>,
  SiExpo: SiExpo as ComponentType<SVGProps<SVGSVGElement>>,
  SiStorybook: SiStorybook as ComponentType<SVGProps<SVGSVGElement>>,
  SiIonic: SiIonic as ComponentType<SVGProps<SVGSVGElement>>,
  SiFlask: SiFlask as ComponentType<SVGProps<SVGSVGElement>>,
  SiRubyonrails: SiRubyonrails as ComponentType<SVGProps<SVGSVGElement>>,
  SiThreedotjs: SiThreedotjs as ComponentType<SVGProps<SVGSVGElement>>,
  // Tools
  SiDocker: SiDocker as ComponentType<SVGProps<SVGSVGElement>>,
  SiGit: SiGit as ComponentType<SVGProps<SVGSVGElement>>,
  SiBun: SiBun as ComponentType<SVGProps<SVGSVGElement>>,
  SiVite: SiVite as ComponentType<SVGProps<SVGSVGElement>>,
  SiWebpack: SiWebpack as ComponentType<SVGProps<SVGSVGElement>>,
  SiGithubactions: SiGithubactions as ComponentType<SVGProps<SVGSVGElement>>,
  SiPrisma: SiPrisma as ComponentType<SVGProps<SVGSVGElement>>,
  SiVitest: SiVitest as ComponentType<SVGProps<SVGSVGElement>>,
  SiPnpm: SiPnpm as ComponentType<SVGProps<SVGSVGElement>>,
  SiGraphql: SiGraphql as ComponentType<SVGProps<SVGSVGElement>>,
  SiNpm: SiNpm as ComponentType<SVGProps<SVGSVGElement>>,
  SiYarn: SiYarn as ComponentType<SVGProps<SVGSVGElement>>,
  SiEslint: SiEslint as ComponentType<SVGProps<SVGSVGElement>>,
  SiPrettier: SiPrettier as ComponentType<SVGProps<SVGSVGElement>>,
  SiJest: SiJest as ComponentType<SVGProps<SVGSVGElement>>,
  SiCypress: SiCypress as ComponentType<SVGProps<SVGSVGElement>>,
  SiDeno: SiDeno as ComponentType<SVGProps<SVGSVGElement>>,
  SiGithub: SiGithub as ComponentType<SVGProps<SVGSVGElement>>,
  SiGitlab: SiGitlab as ComponentType<SVGProps<SVGSVGElement>>,
  SiPostman: SiPostman as ComponentType<SVGProps<SVGSVGElement>>,
  SiBabel: SiBabel as ComponentType<SVGProps<SVGSVGElement>>,
  SiNx: SiNx as ComponentType<SVGProps<SVGSVGElement>>,
  // Databases
  SiPostgresql: SiPostgresql as ComponentType<SVGProps<SVGSVGElement>>,
  SiMysql: SiMysql as ComponentType<SVGProps<SVGSVGElement>>,
  SiMongodb: SiMongodb as ComponentType<SVGProps<SVGSVGElement>>,
  SiRedis: SiRedis as ComponentType<SVGProps<SVGSVGElement>>,
  SiSqlite: SiSqlite as ComponentType<SVGProps<SVGSVGElement>>,
  SiSupabase: SiSupabase as ComponentType<SVGProps<SVGSVGElement>>,
  SiElasticsearch: SiElasticsearch as ComponentType<SVGProps<SVGSVGElement>>,
  SiMariadb: SiMariadb as ComponentType<SVGProps<SVGSVGElement>>,
  // Cloud
  SiGooglecloud: SiGooglecloud as ComponentType<SVGProps<SVGSVGElement>>,
  SiVercel: SiVercel as ComponentType<SVGProps<SVGSVGElement>>,
  SiNetlify: SiNetlify as ComponentType<SVGProps<SVGSVGElement>>,
  SiCloudflare: SiCloudflare as ComponentType<SVGProps<SVGSVGElement>>,
  SiDigitalocean: SiDigitalocean as ComponentType<SVGProps<SVGSVGElement>>,
  // Infra
  SiKubernetes: SiKubernetes as ComponentType<SVGProps<SVGSVGElement>>,
  SiTerraform: SiTerraform as ComponentType<SVGProps<SVGSVGElement>>,
  SiNginx: SiNginx as ComponentType<SVGProps<SVGSVGElement>>,
  SiLinux: SiLinux as ComponentType<SVGProps<SVGSVGElement>>,
  SiTraefikproxy: SiTraefikproxy as ComponentType<SVGProps<SVGSVGElement>>,
  SiPrometheus: SiPrometheus as ComponentType<SVGProps<SVGSVGElement>>,
  SiGrafana: SiGrafana as ComponentType<SVGProps<SVGSVGElement>>,
  SiAnsible: SiAnsible as ComponentType<SVGProps<SVGSVGElement>>,
  SiJenkins: SiJenkins as ComponentType<SVGProps<SVGSVGElement>>,
  SiApache: SiApache as ComponentType<SVGProps<SVGSVGElement>>,
};

/**
 * Exported set of supported Simple Icon component names (without 'si:' prefix).
 * Used in tests to validate TAG_CATALOG consistency against the renderer.
 */
export const SUPPORTED_SI_KEYS: ReadonlySet<string> = new Set(Object.keys(SI_MAP));

/**
 * Brand color map for Simple Icons (hex without '#').
 * Very dark brands (#000 / extremely dark) are replaced with a
 * slightly lighter value so they remain visible on dark backgrounds.
 */
const SI_BRAND_COLORS: Record<string, string> = {
  // Languages
  SiTypescript: '#3178C6',
  SiJavascript: '#F7DF1E',
  SiNodedotjs: '#5FA04E',
  SiPython: '#3776AB',
  SiPhp: '#777BB4',
  SiRust: '#CE422B',
  SiGo: '#00ADD8',
  SiRuby: '#CC342D',
  SiSwift: '#F05138',
  SiKotlin: '#7F52FF',
  SiSharp: '#512BD4',
  SiHtml5: '#E34F26',
  SiDart: '#0175C2',
  SiElixir: '#4B275F',
  SiScala: '#DC322F',
  SiLua: '#2C2D72',
  SiHaskell: '#5D4F85',
  // Frameworks
  SiReact: '#61DAFB',
  SiNextdotjs: '#E8E8E8', // brand is #000, lightened for dark bg
  SiVuedotjs: '#4FC08D',
  SiNuxt: '#00DC82',
  SiAngular: '#DD0031',
  SiSvelte: '#FF3E00',
  SiHono: '#E36002',
  SiExpress: '#B8B8B8', // brand is #000, lightened for dark bg
  SiNestjs: '#E0234E',
  SiFastify: '#B8B8B8', // brand is #000, lightened for dark bg
  SiDjango: '#44B78B', // brand is very dark green, brightened
  SiFastapi: '#009688',
  SiLaravel: '#FF2D20',
  SiSpringboot: '#6DB33F',
  SiTailwindcss: '#06B6D4',
  SiTrpc: '#2596BE',
  SiAstro: '#BC52EE',
  SiRemix: '#B8B8B8',
  SiSolid: '#2C4F7C',
  SiExpo: '#B8B8B8',
  SiStorybook: '#FF4785',
  SiIonic: '#3880FF',
  SiFlask: '#B8B8B8',
  SiRubyonrails: '#D30001',
  SiThreedotjs: '#B8B8B8',
  // Tools
  SiDocker: '#2496ED',
  SiGit: '#F05032',
  SiBun: '#FBF0DF',
  SiVite: '#646CFF',
  SiWebpack: '#8DD6F9',
  SiGithubactions: '#2088FF',
  SiPrisma: '#5A67D8', // brand is very dark, brightened
  SiVitest: '#6E9F18',
  SiPnpm: '#F69220',
  SiGraphql: '#E10098',
  SiNpm: '#CB3837',
  SiYarn: '#2C8EBB',
  SiEslint: '#4B32C3',
  SiPrettier: '#F7B93E',
  SiJest: '#C21325',
  SiCypress: '#69D3A7',
  SiDeno: '#B8B8B8',
  SiGithub: '#B8B8B8',
  SiGitlab: '#FC6D26',
  SiPostman: '#FF6C37',
  SiBabel: '#F9DC3E',
  SiNx: '#143055',
  // Databases
  SiPostgresql: '#4169E1',
  SiMysql: '#4479A1',
  SiMongodb: '#47A248',
  SiRedis: '#FF4438',
  SiSqlite: '#44A8CC', // brand is very dark, brightened
  SiSupabase: '#3ECF8E',
  SiElasticsearch: '#00BFB3',
  SiMariadb: '#003545',
  // Cloud
  SiGooglecloud: '#4285F4',
  SiVercel: '#E8E8E8', // brand is #000, lightened for dark bg
  SiNetlify: '#00C7B7',
  SiCloudflare: '#F38020',
  SiDigitalocean: '#0080FF',
  // Infra
  SiKubernetes: '#326CE5',
  SiTerraform: '#844FBA',
  SiNginx: '#009639',
  SiLinux: '#FCC624',
  SiTraefikproxy: '#24A1C1',
  SiPrometheus: '#E6522C',
  SiGrafana: '#F46800',
  SiAnsible: '#EE0000',
  SiJenkins: '#D24939',
  SiApache: '#D22128',
};

const LUCIDE_MAP: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  Server: Server as ComponentType<SVGProps<SVGSVGElement>>,
  Database: Database as ComponentType<SVGProps<SVGSVGElement>>,
  Terminal: Terminal as ComponentType<SVGProps<SVGSVGElement>>,
  Container: Container as ComponentType<SVGProps<SVGSVGElement>>,
  Cloud: Cloud as ComponentType<SVGProps<SVGSVGElement>>,
  GitBranch: GitBranch as ComponentType<SVGProps<SVGSVGElement>>,
  Zap: Zap as ComponentType<SVGProps<SVGSVGElement>>,
  Code2: Code2 as ComponentType<SVGProps<SVGSVGElement>>,
  Layers: Layers as ComponentType<SVGProps<SVGSVGElement>>,
  Wrench: Wrench as ComponentType<SVGProps<SVGSVGElement>>,
  Tag: Tag as ComponentType<SVGProps<SVGSVGElement>>,
  Shield: Shield as ComponentType<SVGProps<SVGSVGElement>>,
  FileText: FileText as ComponentType<SVGProps<SVGSVGElement>>,
};

/**
 * Exported set of supported Lucide icon component names (without 'lucide:' prefix).
 * Used in tests to validate TAG_CATALOG consistency against the renderer.
 */
export const SUPPORTED_LUCIDE_KEYS: ReadonlySet<string> = new Set(Object.keys(LUCIDE_MAP));

/**
 * Default Lucide icon shown when an icon_key doesn't resolve.
 * Provides a semantically meaningful fallback for each tag category.
 */
const CATEGORY_DEFAULT_ICON: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  language: Code2 as ComponentType<SVGProps<SVGSVGElement>>,
  framework: Layers as ComponentType<SVGProps<SVGSVGElement>>,
  tool: Wrench as ComponentType<SVGProps<SVGSVGElement>>,
  db: Database as ComponentType<SVGProps<SVGSVGElement>>,
  cloud: Cloud as ComponentType<SVGProps<SVGSVGElement>>,
  infra: Server as ComponentType<SVGProps<SVGSVGElement>>,
  other: Tag as ComponentType<SVGProps<SVGSVGElement>>,
};

interface TechIconProps {
  iconKey?: string | null;
  /** Tag category — used to pick a meaningful default icon when iconKey doesn't resolve */
  category?: string | null;
  name?: string;
  className?: string;
  size?: number;
  /** When true, Simple Icons render in their real brand color instead of currentColor */
  originalColor?: boolean;
}

export function TechIcon({
  iconKey,
  category,
  name,
  className = 'h-5 w-5',
  size,
  originalColor = false,
}: TechIconProps) {
  const style = size ? { width: size, height: size } : undefined;

  /** Render a category default SVG when the specific icon is unavailable */
  const renderCategoryDefault = () => {
    if (category) {
      const DefaultIcon = CATEGORY_DEFAULT_ICON[category];
      if (DefaultIcon)
        return <DefaultIcon className={className} style={style} aria-hidden="true" />;
    }
    return name ? <Badge variant="secondary">{name}</Badge> : null;
  };

  if (!iconKey) return renderCategoryDefault();

  if (iconKey.startsWith('si:')) {
    const componentName = iconKey.slice(3); // e.g. 'SiReact'
    const Icon = SI_MAP[componentName];
    if (Icon) {
      const brandColor = originalColor ? SI_BRAND_COLORS[componentName] : undefined;
      const iconStyle = brandColor ? { ...style, color: brandColor, fill: brandColor } : style;
      return <Icon className={className} style={iconStyle} aria-hidden="true" />;
    }
  }

  if (iconKey.startsWith('lucide:')) {
    const componentName = iconKey.slice(7); // e.g. 'Server'
    const Icon = LUCIDE_MAP[componentName];
    if (Icon) return <Icon className={className} style={style} aria-hidden="true" />;
  }

  return renderCategoryDefault();
}
