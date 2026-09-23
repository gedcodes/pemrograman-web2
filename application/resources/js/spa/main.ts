import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import '../../css/spa.css';

createApp(App).use(router).mount('#spa');
