# Design Decisions

## Triple-Hash Verification vs Self-Signed Hashing
Using triple-hash verification enhances security by ensuring that data integrity is maintained through multiple verification stages. This approach eliminates the risk of a single point of failure inherent in self-signed hashing, thereby providing more robust protection against data tampering.

## Excel Import vs OCR
The decision to implement Excel import over OCR stems from the need for accuracy and efficiency. Excel files provide structured data, allowing for direct extraction without the errors commonly associated with OCR technology, which can misinterpret characters and formatting.

## Importance of CHSI Integration
Integrating with the China Higher Education Student Information (CHSI) system is pivotal for validating academic credentials. This integration ensures that the data being processed is legitimate and recognized by the educational authorities, which is essential for maintaining the credibility of the tool.

## GPA Calculation for International and Domestic Scales
Showing GPA on both international and domestic scales addresses the diverse needs of users. It provides clarity for institutions and students who may be applying for programs in different educational systems, ensuring transparency and ease in understanding academic performance.

## Data Isolation Between Chinese and English Versions
Maintaining data isolation between the Chinese and English versions addresses the need for cultural sensitivity and compliance with regional data protection regulations. This ensures that user-specific data is segregated according to language preferences, enhancing user trust and security.

## Mandatory Watermarks and PDF Metadata
Mandatory watermarks and proper PDF metadata add layers of authenticity and traceability to the documents produced. This measure deters unauthorized duplication and provides critical information regarding document origin and usage, which is especially important in academic settings.

## Rejection of Credential Simulation
The tool's rejection of any form of credential simulation is based on ethical considerations. Allowing simulated credentials undermines the integrity of educational systems and can lead to fraudulent activities. This strict policy ensures that all credentials provided through the tool are genuine and verifiable, promoting a more honest academic environment.