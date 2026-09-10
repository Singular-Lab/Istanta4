import type { OlympusUserPolicyRuolo } from "../../../../lib/types.js";

export type AgenziaPolicyCatalogItem = {
  code: string;
  description: string;
  codificaFico: string;
};

export type AgenziaPolicySettoreCatalogItem = AgenziaPolicyCatalogItem & {
  settoriFinali: string[];
};

export type AgenziaPolicyCatalog = {
  version: number;
  source: string;
  generatedAt?: string;
  ruoli: AgenziaPolicyCatalogItem[];
  aree: AgenziaPolicyCatalogItem[];
  settoriFinali: AgenziaPolicyCatalogItem[];
  settori: AgenziaPolicySettoreCatalogItem[];
};

export type PolicyErrorPolicy = "strict_fail";

export type PolicyTreeStrategy =
  | "role_area_reparti_siblings"
  | "role_reparto_chain_area_leaf";

export type AgenziaPolicyRules = {
  version: number;
  errorPolicy: PolicyErrorPolicy;
  expressions: {
    inputRegex: string;
    flags?: string;
    groups: {
      role: string;
      body: string;
    };
  };
  parsing: {
    normalize: {
      trim: boolean;
      toUpper: boolean;
    };
    areaExtraction: {
      mode: "suffix_longest_match";
      required?: boolean;
    };
    settoreTokenization: {
      mode: "deterministic_longest_match";
      allowEmpty?: boolean;
    };
  };
  tree: {
    strategy: PolicyTreeStrategy;
    nodeTypes?: {
      role?: string;
      area?: string;
      reparto?: string;
    };
  };
  messageTemplates?: Partial<Record<PolicyBuildErrorCode, string>>;
};

export type PolicyBuildErrorCode =
  | "INVALID_INPUT"
  | "INVALID_RULES"
  | "INVALID_INPUT_FORMAT"
  | "ROLE_NOT_FOUND"
  | "AREA_NOT_FOUND"
  | "REPARTO_SEGMENTATION_FAILED"
  | "AMBIGUOUS_SEGMENTATION"
  | "CATALOG_INCONSISTENT";

export type PolicyBuildStep =
  | "normalize"
  | "split"
  | "role"
  | "area"
  | "reparto"
  | "final_settori"
  | "tree"
  | "config";

export type PolicyBuildError = {
  code: PolicyBuildErrorCode;
  step: PolicyBuildStep;
  message: string;
  input: string;
  details?: Record<string, unknown>;
};

export type PolicyBuildSuccessResultV2 = {
  ok: true;
  tree: OlympusUserPolicyRuolo[];
  roleCode: string;
  areaCode: string | null;
  repartoCodes: string[];
  finalSettori: string[];
  error: null;
};

export type PolicyBuildFailureResultV2 = {
  ok: false;
  tree: OlympusUserPolicyRuolo[];
  roleCode: null;
  areaCode: null;
  repartoCodes: string[];
  finalSettori: string[];
  error: PolicyBuildError;
};

export type PolicyBuildResultV2 =
  | PolicyBuildSuccessResultV2
  | PolicyBuildFailureResultV2;

export type PolicyBuildConfigV2 = {
  catalog: AgenziaPolicyCatalog;
  rules: AgenziaPolicyRules;
};

