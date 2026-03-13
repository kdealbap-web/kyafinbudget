/** Tipo de portafolio */
export enum PortfolioType {
    Personal = 'personal',
    Household = 'household',
}

/** Labels amigables para los tipos de portafolio */
export const PORTFOLIO_TYPE_LABELS: Record<PortfolioType, string> = {
    [PortfolioType.Personal]: 'Personal',
    [PortfolioType.Household]: 'Hogar',
};

/** Portafolio financiero almacenado en la tabla `portfolios` */
export interface Portfolio {
    readonly id: string;
    name: string;
    type: PortfolioType;
    owner_id: string;
    partner_id: string | null;
    created_at?: string;
    updated_at?: string;
}
