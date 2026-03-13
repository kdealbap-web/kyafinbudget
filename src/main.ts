import { registerLocaleData } from '@angular/common';
import localeEsCO from '@angular/common/locales/es-CO';
import localeEsCOExtra from '@angular/common/locales/extra/es-CO';
import { bootstrapApplication } from '@angular/platform-browser';

import { appConfig } from './app/app.config';
import { AppComponent } from './app/app';

registerLocaleData(localeEsCO, 'es-CO', localeEsCOExtra);

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
