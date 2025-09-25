export interface RegistryItem {
    id: string;
    name: string;
    description?: string;
    aliasIds?: string[];
    /**
     * Some extensions should not be user selectable
     *  like: 'all' and 'any' matchers;
     */
    excludeFromPicker?: boolean;
}

export type UiRegistryItem<T extends RegistryItem, B> = T & {
    builder: B;
}

interface BuilderConstructor<B> {
    new(): B
}

export class Registry<T extends RegistryItem, B> {
    private readonly items = new Map<string, UiRegistryItem<T, B>>();
    private initialized = false;

    constructor(
        private readonly builder: BuilderConstructor<B>,
        private init?: () => [T, (builder: B) => void][],
    ) { }

    private initIfNeeded() {
        if (!this.initialized && this.init) {
            for (const [ext, o] of this.init()) {
                this.register(ext, o);
            }
        }

        this.initialized = true;
    }

    getIfExists(id: string | undefined): UiRegistryItem<T, B> | undefined {
        this.initIfNeeded();

        if (!id) {
            return undefined;
        }

        return this.items.get(id);
    }

    setInit(init: () => [T, (builder: B) => void][]) {
        this.init = init;
    }

    get(id: string): T {
        const item = this.getIfExists(id);
        if (!item) {
            throw new Error(`No item with id '${id}'`);
        }

        return item;
    }

    /**
     * Return a list of values by ID, or all values if not specified
     */
    list(ids?: string[]): T[] {
        this.initIfNeeded();

        if (ids) {
            return Array.from(this.items.values())
                .filter(v => ids.includes(v.id));
        } else {
            return Array.from(this.items.values());
        }
    }

    isEmpty(): boolean {
        this.initIfNeeded();
        return this.items.size === 0;
    }

    register(ext: T, options: (builder: B) => void): void {
        const builder = new this.builder();
        options(builder);

        const extUi = ext as UiRegistryItem<T, B>;
        extUi.builder = builder;

        this.items.set(ext.id, extUi);
    }
}
