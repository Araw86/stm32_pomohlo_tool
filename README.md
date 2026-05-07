# Document opener for STM32

Download [here](https://github.com/Araw86/stm32_pomohlo_tool/releases)


## Tool

Tool showing STM32/SM8 device lines. And their documentations.
On click if document is present he will opens it

<img width="1059" height="723" alt="main_screen" src="https://github.com/user-attachments/assets/9e0339da-e3fb-47fb-b7d4-b1631908654e" />


## Settings

<img width="1059" height="723" alt="settings" src="https://github.com/user-attachments/assets/e8c855d7-de74-49ba-a6fb-2e000f655d37" />

### Set repositroy path

Tool need a location for repositry where to download datasheets.Adn where to look for them

### Document version check

If you want to pen document toll will check if new version is available and offers to download it

### Document database checl

At startup tool offers download new database

## Databse

<img width="1059" height="723" alt="settings" src="https://github.com/user-attachments/assets/77d84dfe-64ab-410c-bceb-763b86e4f661" />

Allow to see which device database version is used. 
You can manully trigger download.

## Download

<img width="1059" height="723" alt="download" src="https://github.com/user-attachments/assets/8be70548-98fc-490d-945f-1fb824b15e0c" />

Tool check the documents in you reopsitroy and offers to download them

### download all documents

Trigger full download aof all documents.

### Download missing docuemtts

Download only documents which are missing

### Download new documents

Download new version of documetns on disk. Beckups the old ones. 

## Custom family

<img width="1059" height="723" alt="custom_family" src="https://github.com/user-attachments/assets/fc7f9681-fb0a-47f7-9d7d-34b901530efb" />

Allow to create your own device family. For STM32 or other devices. 

All documents need to be local. Tool will move them to his repositroy

Export/import. Tool can export/import the custom famili in zip. where is family description in json. And all document pdf files. 


# Feedback

feedback and problems pelase write into [Issues](https://github.com/Araw86/stm32_pomohlo_tool/issues) section


<!-- ## Configuration

App must have correctly configured paths in settings:

![23_01_05_265](https://user-images.githubusercontent.com/48834492/210720849-3c5c4fa2-8999-4c84-a8ca-52c026501ac5.png)

The path `%USERPROFILE%/.stmcufinder` will lead to user folder. Where is .stmcufinder installed by default.
The CubeMX repository path must be set manually.

Tool should store this configuration and will be used for each run.

If Path to .stmcufinder is wrong. Orcube-finder-db.db is missing. No documentation will be visible.
If repository path is wrong or the no pdf is present tool will not open the documentation.

## Download STM32 documentation.

It is possible to do it in CubeMX on version 6.6.1 and older. In `Menu->Help->Refresh Data->Download`
![23_01_05_266](https://user-images.githubusercontent.com/48834492/210721747-cd0cd32b-dfa8-479d-a18a-28d16c2196b2.png)

Or is possible to use STMCUFinder and use `Settings icon->Refresh data->Download`
![23_01_05_267](https://user-images.githubusercontent.com/48834492/210721998-91e1673f-7821-4b39-993a-535218d756af.png)

Be sure you have correct repository path.

## Info

The program is able to open the documentation, if file is downloaded in repository.
This is possible to set in configuration.

The documentation can be downloaded with STM32CubeFinder which still have this option. From MX this option disappeared. -->
