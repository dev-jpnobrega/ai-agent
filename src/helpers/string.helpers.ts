export function interpolate<T>(inputString: string, args: T, options = { openedWith: "(", closedWith: ")" }) {
    let interpolatedString = inputString

    for (let key in args) {
        interpolatedString = interpolatedString
            .replace(`${options.openedWith}${key}${options.closedWith}`,
                args[key as keyof T] as string);
    }

    return interpolatedString;
}