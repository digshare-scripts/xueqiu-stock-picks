import {devRun} from '@digshare/script';

import main from './index';

devRun(process.env.DIGSHARE_ENV === 'development', {}, main);