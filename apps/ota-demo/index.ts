import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent 内部调用 AppRegistry.registerComponent('main', () => App);
// 同时保证无论在 Expo Go 还是原生构建中加载应用，运行环境都能被正确初始化
registerRootComponent(App);
