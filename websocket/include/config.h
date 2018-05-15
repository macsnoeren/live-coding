#ifndef WS_CONFIG_H
#define WS_CONFIG_H

/*! \file     config.h is used to get the global preprocessor defines for all sources.
 *  \details   config.h is used to put all the global defines that are used within all the classes. FT_DEBUG for example is used to compile extra debug information. Another example is FT_VERSION information that could be used (or printed).
 *  \author    Maurice Snoeren
 *  \version   1.0
 *  \date      28-01-2014
 *  \bug       No known bugs
 *  \warning   No warnings to give
 *  \copyright lila BV - part of the Lothian group
 */

/*! WS_VERSION contains the version string of the FunTracer source application. */
#define WS_VERSION "0.1.0"

/*! FT_DEBUG contains the level number that can be checked before debug information is printed out to the console. The higher the level the more debug information is printed. We will use 1-5 most probably. */
#define WS_DEBUG 0

#endif

