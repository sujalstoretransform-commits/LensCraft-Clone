export class PriceError extends Error { }

type Price = {
    code: string;
    amountMinor: number;
    lensIndex?: { code: string } | null;
}

type TechnologyPrice = {
    code: string;
    amountMinor: number;
}

type TechnologyMapping = {
    lensType: { code: string };
    lensTechnology: {
        code: string;
        name: string;
        lensPrices: TechnologyPrice[];
    };
}

type Catalog = {
    lensTypes: { code: string, name: string, prices: Price[] }[]
    lensOptions: { code: string, name: string, prices: Price[], lensTechnologyOptions?: TechnologyMapping[] }[]
}

type PriceSelection = {
    lensTypeCode: string;
    lensIndexCode?: string;
    optionCodes: string[];
    lensTechnologyCode?: string;
}

const getOneprice = (prices: Price[], typeName: string) => {
    if (prices.length !== 1) {
        throw new PriceError(`Expected 1 price for ${typeName}, found ${prices.length}.`);
    }

    return prices[0]
}

export const calculatePrice = (
    catalog: Catalog,
    selection: PriceSelection,
    framePriceMinor: number,
) => {
    if (!Number.isInteger(framePriceMinor) || framePriceMinor < 0) {
        throw new PriceError("Frame price must be a whole number in minor units.");
    }

    const type = catalog.lensTypes.find((t) => t.code === selection.lensTypeCode);
    if (!type) throw new PriceError(`Unknown lens type: ${selection.lensTypeCode}`);

    const items: { code: string; label: string; amountMinor: number }[] = []

    const typePrice = getOneprice(
        type.prices.filter((p) => !p.lensIndex),
        type.name
    )

    items.push({ code: typePrice.code, label: type.name, amountMinor: typePrice.amountMinor })

    if (selection.lensIndexCode) {
        const indexPrice = getOneprice(
            type.prices.filter((p) => p.lensIndex?.code === selection.lensIndexCode),
            `${type.name} + index ${selection.lensIndexCode}`,
        )
        items.push({ code: indexPrice.code, label: `Index ${selection.lensIndexCode}`, amountMinor: indexPrice.amountMinor })
    }

    for (const code of selection.optionCodes) {
        const option = catalog.lensOptions.find((o) => o.code === code)
        if (!option) throw new PriceError(`Unknown option: ${code}`);

        if (option.prices.length > 0) {
            const optionPrice = getOneprice(option.prices, option.name)
            items.push({ code: optionPrice.code, label: option.name, amountMinor: optionPrice.amountMinor })
        }

        if (!selection.lensTechnologyCode) continue;

        const technologyMapping = option.lensTechnologyOptions?.find(
            (mapping) =>
                mapping.lensType.code === selection.lensTypeCode &&
                mapping.lensTechnology.code === selection.lensTechnologyCode
        )

        if (technologyMapping) {
            const technology = technologyMapping.lensTechnology;
            const technologyPrice = getOneprice(
                technology.lensPrices,
                technology.name
            );

            items.push({
                code: technologyPrice.code,
                label: technology.name,
                amountMinor: technologyPrice.amountMinor
            })
        } else if (
            option.lensTechnologyOptions?.some(
                (mapping) => mapping.lensType.code === selection.lensTypeCode
            )) {
            throw new PriceError(
                `Technology ${selection.lensTechnologyCode} is not available for ${option.name}.`,
            );
        }
    }

    const lensTotalMinor = items.reduce((sum, item) => sum + item.amountMinor, 0)

    return {
        items,
        frameMinor: framePriceMinor,
        lensTotalMinor,
        totalMinor: framePriceMinor + lensTotalMinor
    }

}