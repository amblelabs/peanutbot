
export function trimJoin({
    texts,
    sep = '\n',
    prefix = '',
    suffix = '',
    ellipsis = '…',
    maxLength = 2000 - 1,
} : {
    texts: string[], 
    sep?: string, 
    prefix?: string, 
    suffix?: string, 
    ellipsis?: string,
    maxLength?: number,
}): string {
    const totalSeps = texts.length + (prefix.length ? 1 : 0) + (suffix.length ? 1 : 0);
    const totalSepLength = sep.length * totalSeps;
    const totalAuxLength = prefix.length + suffix.length;

    const maxPartLength = (
        maxLength - totalAuxLength - totalSepLength
    ) / texts.length;

    let result = '';

    if (prefix) result += prefix + sep;

    for (let text of texts) {
        if (text.length > maxPartLength) {
            text = text.substring(0, maxPartLength - 1);
            text += ellipsis;
        }

        result += text + sep;
    }

    if (suffix) result += suffix + sep;

    return result;
}