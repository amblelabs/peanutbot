import config from "config.json";

type SearchResult = [found: boolean, weight: number];
type SupportResult = [weight: number, message: string];
type SupportSearchResult = [success: boolean, message: string];

type SupportType = {
    keywords: string[],
    question: string,
    answers: string[],
};

const SUPPORT_TYPES: [string, SupportType][] = Object.entries(config.support.types);

const FULL_FIND: SearchResult = [true, 2];
const PARTIAL_FIND: SearchResult = [false, 1];
const NO_FIND: SearchResult = [false, 0];

function hasKeyword(content: string, keyword: string): SearchResult {
    if (keyword.includes('|')) {
        for (const v of keyword.split('|')) {
            const result = hasKeyword(content, v);
            if (result[1] != 0) return result;
        }

        return NO_FIND;
    }

    const isOptional = keyword.charAt(0) == '?';

    if (isOptional) {
        keyword = keyword.substring(1);
    }

    return content.includes(keyword) ? FULL_FIND 
        : isOptional ? PARTIAL_FIND : NO_FIND;
}

function countKeywords(content: string, keywords: string[], l: (kw: string) => void): number {
    let count = 0;
    let anyFound = false;

    for (const keyword of keywords) {
        const [real, weight] = hasKeyword(content, keyword);

        if (!real && weight == 0) return 0;
        
        count += weight;
        anyFound ||= real;

        l(keyword);
    }

    return anyFound ? count : 0;
}

async function provideSupport(content: string): Promise<SupportSearchResult> {
    let qi = 1;

    const results: SupportResult[] = [];

    for (const [k, { keywords, question, answers }] of SUPPORT_TYPES) {
        const keywordBuilder: string[] = [];
        
        const weight = countKeywords(content, keywords, keyword => {
            keywordBuilder.push(config.support.format.keywords.replaceAll('$KEYWORD', keyword));
        })

        if (weight === 0)
            continue;
        
        const msgBuilder = [
            `\`Q${qi}:\` ${question}`,
            ...answers.map((answer, i) => `- \`A${i + 1}:\` ${answer}`),
            config.support.format.footer.replaceAll('$TYPE', k)
                .replaceAll('$KEYWORDS', keywordBuilder.toString())
                .replaceAll('$WEIGHT', weight.toString())
        ];

        results.push([weight, msgBuilder.join('\n')]);
        qi++;
    }

    if (results.length == 0) {
        return [false, config.support.format.header + '\n' 
            + config.support.format.fail];
    }

    return [true, config.support.format.header + '\n' + results
            .sort(([a1], [b1]) => b1 - a1).slice(0, 3)
            .map(([, v]) => v).join('\n\n')];
}

export default {
    provideSupport
}