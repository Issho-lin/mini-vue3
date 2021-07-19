const isObj = obj => typeof obj === 'object' && obj !== null

let effectFn = null

const targetMap = new WeakMap()

const Vue = {
    createApp(options) {
        const renderer = Vue.createRenderer({
            querySelector(el) {
                return document.querySelector(el)
            },
            insert(parent, child, anchor = null) {
                parent.innerHTML = ''
                parent.insertBefore(child, anchor)
            }
        })
        return renderer.createApp(options)
    },
    createRenderer({ querySelector, insert }) {
        return {
            createApp(options) {
                return {
                    mount(el) {
                        const parent = querySelector(el)
        
                        if (options.setup) {
                            this.setup = options.setup()
                        }
                        if (options.data) {
                            this.data = options.data()
                        }
                        if (!options.render) {
                            options.render = this.compile(parent.innerHTML)
                        }
                        this.proxy = new Proxy(this, {
                            get(target, key) {
                                if (key in target.setup) {
                                    return Reflect.get(target.setup, key)
                                }
                                return Reflect.get(target.data, key)
                            },
                            set(target, key, val) {
                                if (key in target.setup) {
                                    return Reflect.set(target.setup, key, val)
                                }
                                return Reflect.set(target.data, key, val)
                            }
                        })
                        Vue.effect(() => {
                            const child = options.render.call(this.proxy)
                            insert(parent, child)
                        }, [])
                    },
                    compile(template) {
                        return function () {
                            const h3 = document.createElement('h3')
                            h3.textContent = this.title
                            return h3
                        }
                    }
                }
            }
        }
    },
    reactive(obj) {
        if (!isObj) {
            return obj
        }
        return new Proxy(obj, {
            get(target, key) {
                const res = Reflect.get(target, key)
                Vue.track(target, key)
                return isObj(res) ? reactive(res) : res
            },
            set(target, key, value) {
                const res = Reflect.set(target, key, value)
                Vue.trigger(target, key)
                return res
            },
            deleteProperty(target, key) {
                const res = Reflect.deleteProperty(target, key)
                Vue.trigger(target, key)
                return res
            }
        })
    },
    effect(fn) {
        const e = Vue.createReactiveEffect(fn)
        e()
        return e
    },
    createReactiveEffect(fn) {
        return function () {
            try {
                effectFn = fn
                fn()
            } finally {
                effectFn = null
            }
        }
    },
    // { target: { key: [fn1, fn2, ...] } }
    track(target, key) {
        if (!effectFn) {
            return
        }
        let depsMap = targetMap.get(target)
        if (!depsMap) {
            depsMap = new Map()
            targetMap.set(target, depsMap)
        }
        let deps = depsMap.get(key)
        if (!deps) {
            deps = new Set()
            depsMap.set(key, deps)
        }
        deps.add(effectFn)
    },
    trigger(target, key) {
        const depsMap = targetMap.get(target)
        if (!depsMap) {
            return
        }
        const deps = depsMap.get(key)
        if (deps) {
            deps.forEach(dep => dep())
        }
    }
}