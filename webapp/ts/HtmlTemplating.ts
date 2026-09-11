export type ChildElement = string | HTMLElement | TemplateElement;

export class TemplateElement {
    element: HTMLElement;
    namespace: string | undefined;

    constructor(element: HTMLElement, namespace?: string) {
        this.element = element;
        this.namespace = namespace;
    }

    child(
        children: ChildElement | ChildElement[],
        styleMapper?: ((element: HTMLElement) => HTMLElement) | undefined
    ): TemplateElement {
        if (!children)
            return this;

        if (styleMapper === undefined) {
            styleMapper = x => x;
        }

        const ns = this.namespace;
        const _html = function (html: string): TemplateElement {
            if (ns) {
                return TemplateElement.htmlNs(html, ns);
            } else {
                return TemplateElement.html(html);
            }
        }

        if (typeof (children) === "string") {
            this.element.appendChild(styleMapper(_html(children).element));
        } else if (typeof (children) === "object") {
            if (Array.isArray(children)) {
                if (children.length <= 0)
                    return this;

                for (let child1 of children) {
                    if (typeof (child1) === 'string') {
                        this.element.appendChild(styleMapper(_html(child1).element));
                    } else if (child1 instanceof TemplateElement) {
                        this.element.appendChild(styleMapper(child1.element));
                    } else {
                        this.element.appendChild(styleMapper(child1));
                    }
                }
            } else if (children instanceof TemplateElement) {
                this.element.appendChild(styleMapper(children.element));
            } else {
                this.element.appendChild(styleMapper(children));
            }
        } else {
            throw new Error(`unsupported argument type for 'children'. Found ${typeof (children)} expected ('string' | 'object')`);
        }
        return this;
    }

    // called 'and' instead of 'then' because Typescript TS80006 was written by a moron who checks for any function named 'then', instead of using the FUCKING TYPE SYSTEM to detect Promises.
    and(fnc: (item: HTMLElement) => void): TemplateElement {
        fnc(this.element);
        return this;
    }

    and2(fnc: (item: TemplateElement) => void): TemplateElement {
        fnc(this);
        return this;
    }

    public static html(htmlString: string): TemplateElement {
        let template = document.createElement('template');
        template.innerHTML = htmlString.trim();
        return new TemplateElement(<HTMLElement>template.content.firstChild);
    }

    public static htmlNs(htmlString: string, namespace: string): TemplateElement {
        let template = document.createElementNS(namespace, 'template');
        template.innerHTML = htmlString.trim();
        return new TemplateElement(<HTMLElement>template.firstChild, namespace);
    }
}