cmake_minimum_required (VERSION 3.0)

project (Live-Coding-WebSocket-Server)

set (Example_VERSION_MAJOR 0)
set (Example_VERSION_MINOR 1)

set(CMAKE_BUILD_TYPE Debug)
#set(CMAKE_BUILD_TYPE Release)

option(USE_STANDALONE_ASIO "set ON to use standalone Asio instead of Boost.Asio" OFF)
option(BUILD_TESTING "set ON to build library tests" OFF)

set(CMAKE_INCLUDE_CURRENT_DIR ON)

include_directories(../include)
include_directories(../include/sws) # Simple-WebSocket-Server Library

find_package(Threads REQUIRED)
find_package(OpenSSL REQUIRED)

add_compile_options(-std=c++11 -Wall -Wextra -Wsign-conversion)

add_library(simple-websocket-server INTERFACE)
target_include_directories(simple-websocket-server INTERFACE ${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(simple-websocket-server INTERFACE ${CMAKE_THREAD_LIBS_INIT})

# TODO 2020 when Debian Jessie LTS ends:
# Remove Boost system, thread, regex components; use Boost::<component> aliases; remove Boost target_include_directories
if (USE_STANDALONE_ASIO)
    target_compile_definitions(simple-websocket-server INTERFACE USE_STANDALONE_ASIO)
    include(CheckIncludeFileCXX)
    CHECK_INCLUDE_FILE_CXX(asio.hpp HAVE_ASIO)
    if(NOT HAVE_ASIO)
        message(FATAL_ERROR "Standalone Asio not found")
    endif()
else ()
    find_package(Boost 1.54.0 COMPONENTS system thread coroutine context REQUIRED)
    target_link_libraries(simple-websocket-server INTERFACE ${Boost_LIBRARIES})
    target_include_directories(simple-websocket-server INTERFACE ${Boost_INCLUDE_DIR})
    if("${CMAKE_CXX_COMPILER_ID}" STREQUAL "GNU" AND CMAKE_CXX_COMPILER_VERSION VERSION_LESS 4.9)
        target_compile_definitions(simple-websocket-server INTERFACE USE_BOOST_REGEX)
        find_package(Boost 1.54.0 COMPONENTS regex REQUIRED)
        target_link_libraries(simple-websocket-server INTERFACE ${Boost_LIBRARIES})
        target_include_directories(simple-websocket-server INTERFACE ${Boost_INCLUDE_DIR})
    endif()
endif()

target_link_libraries(simple-websocket-server INTERFACE ${OPENSSL_LIBRARIES})
target_include_directories(simple-websocket-server INTERFACE ${OPENSSL_INCLUDE_DIR})

add_executable(websocket websocket.cpp include/WebSocketProtocol.cpp include/WebSocketProtocol/Echo.cpp
               include/WebSocketProtocol/Workspace.cpp include/WebSocketMessage.cpp include/WebSocketMessage/Workspace.cpp)
target_link_libraries(websocket simple-websocket-server)
target_link_libraries(websocket ${Boost_LIBRARIES})
target_include_directories(websocket PRIVATE ${Boost_INCLUDE_DIR})

add_executable(wsclient wsclient.cpp include/RemoteServer.cpp)
target_link_libraries(wsclient pthread)
